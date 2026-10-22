// Simula um jogador guloso para checar o ritmo da economia.
// Uso: node scripts/sim.mjs [horas]
import { Game, B, upgCost } from '../js/engine.js';
import { LUX, MARCOS } from '../js/data.js';
import { money, time } from '../js/fmt.js';

const HOURS = Number(process.argv[2] || 8);
const g = new Game();
g.s.boosts = [];
let t = 0;
const dt = 0.25;
const log = (...a) => console.log(time(t).padStart(9), ...a);
let marco = 0, lastBiz = 0, lastPrestigeT = 0;

function rateIf(fn, undo) {
  const before = g.incomeRateAll();
  fn(); const after = g.incomeRateAll(); undo();
  return after - before;
}
// renda contando negócios sem gerente (o bot clica neles)
g.incomeRateAll = function () {
  const gm = this.baseMult; let r = 0;
  for (let i = 0; i < B.length; i++) r += this.bizRate(i, gm);
  return r;
};

function decide() {
  const s = g.s;
  // gerentes primeiro
  for (let i = 0; i < B.length; i++) if (s.biz[i].n > 0 && !s.biz[i].m && g.mgrCost(i) <= s.cash) { g.hireMgr(i); log('gerente', B[i].name); }
  const opts = [];
  const rate = Math.max(1, g.incomeRateAll());
  for (let i = 0; i < g.unlockedCount(); i++) {
    const c = g.costOf(i, 1);
    const d = rateIf(() => { s.biz[i].n++; g.recalcBiz(i); }, () => { s.biz[i].n--; g.recalcBiz(i); });
    opts.push({ c, v: d, f: () => g.buyBiz(i, 1), name: 'biz' + i });
  }
  for (const u of g.upgCandidates().slice(0, 6)) {
    const before = rate;
    let d;
    if (u.chain === 'g') d = before * 2;
    else if (u.chain === 't') d = 1;
    else d = g.bizRate(u.chain, g.baseMult) * 2;
    opts.push({ c: u.cost, v: d, f: () => g.buyUpg(u.chain), name: 'upg' });
  }
  const li = LUX.findIndex((x, i) => !s.lux.includes(i));
  if (li >= 0) opts.push({ c: LUX[li].price, v: rate * (LUX[li].mult - 1), f: () => g.buyLux(li), name: 'lux' });
  // payback efetivo: tempo para juntar + tempo para pagar
  for (const o of opts) o.score = Math.max(0, o.c - s.cash) / rate + o.c / Math.max(1e-9, o.v);
  opts.sort((a, b) => a.score - b.score);
  const best = opts[0];
  if (best && best.c <= s.cash) { best.f(); return true; }
  return false;
}

const end = HOURS * 3600;
let decideAcc = 0;
while (t < end) {
  const taps = t < 1800 ? 4 : 1;
  g.tap(taps * dt);
  for (let i = 0; i < B.length; i++) if (!g.s.biz[i].m) g.runBiz(i);
  g.tick(dt);
  t += dt;
  decideAcc += dt;
  if (decideAcc >= 1) { decideAcc = 0; for (let k = 0; k < 30 && decide(); k++); }
  while (marco < MARCOS.length && g.s.lifetimeAll >= MARCOS[marco].v) { log('MARCO', MARCOS[marco].name, '| renda', money(g.incomeRate(false)) + '/s'); marco++; }
  const u = g.unlockedCount();
  if (u > lastBiz) { lastBiz = u; log('desbloqueou', B[u - 1].name); }
  const pend = g.starsPending();
  if (pend >= Math.max(15, g.s.stars * 1.0) && t - lastPrestigeT > 900) {
    log(`PRESTÍGIO +${pend}⭐ (tinha ${g.s.stars})  renda era ${money(g.incomeRate(false))}/s`);
    g.prestige(); lastPrestigeT = t; lastBiz = 0;
    // gasta estrelas: carisma barato
  }
}
log('FIM', money(g.s.lifetimeAll), 'estrelas', g.s.stars, 'renda', money(g.incomeRate(false)));
console.log(g.s.biz.map((b, i) => b.n).join(' '), 'upg', g.s.upg.g, g.s.upg.b.join(','), 'lux', g.s.lux.length, 'ach', Object.keys(g.s.ach).length);
