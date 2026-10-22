// Motor do jogo: estado, economia, bolsa, eventos. Sem DOM, para poder simular no Node.
import { BIZ, TIMES, LUX, MARCOS, PERKS, ASSETS, NEWS, EVENTS } from './data.js';

export const TUNE = {
  costF: 15,      // custo do negócio i = 10 * costF^i
  incF: 4.2,      // renda/s de uma unidade cresce incF por nível
  inc0: 0.5,      // renda/s da primeira unidade
  mgrF: 200,      // gerente custa mgrF x custo base (cai nos níveis altos)
  upgB: [3.5, 4], // melhoria de negócio: custo base * 10^(a + b*k)
  upgG: [7, 5],   // melhoria global: 10^(a + b*k)
  starK: 25, starDiv: 1e9, starPow: 0.25, // estrelas = K * (ganhos/div)^pow
};

export const B = BIZ.map((b, i) => {
  const cost = 10 * Math.pow(TUNE.costF, i);
  const inc = TUNE.inc0 * Math.pow(TUNE.incF, i);
  const t = TIMES[i];
  return {
    ...b, i, cost, t,
    rev: inc * t * (i === 0 ? 2 : 1),
    r: i === 0 ? 1.1 : Math.max(1.08, 1.15 - 0.004 * (i - 1)),
    mgrCost: cost * TUNE.mgrF * Math.pow(0.85, i),
  };
});

// ---------- Marcos de quantidade (por negócio) ----------
const MS_BASE = [10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const SPEED_AT = new Set([25, 50, 100, 200, 300, 400]);
export function msAt(k) { return k < MS_BASE.length ? MS_BASE[k] : 500 + (k - MS_BASE.length + 1) * 100; }
export function msType(v) { return SPEED_AT.has(v) ? 'speed' : v > 500 ? 'x3' : 'x2'; }
export function milestoneOf(n) {
  let profit = 1, speed = 1, k = 0;
  for (; ; k++) {
    const v = msAt(k);
    if (n < v) break;
    const ty = msType(v);
    if (ty === 'speed') speed *= 2; else if (ty === 'x3') profit *= 3; else profit *= 2;
  }
  const prev = k > 0 ? msAt(k - 1) : 0;
  const next = msAt(k);
  return { profit, speed, prev, next, nextType: msType(next) };
}

// ---------- Melhorias (cadeias infinitas) ----------
export function upgCost(chain, k) {
  if (chain === 'g') return Math.pow(10, TUNE.upgG[0] + TUNE.upgG[1] * k);
  if (chain === 't') return 50 * Math.pow(20, k);
  return B[chain].cost * Math.pow(10, TUNE.upgB[0] + TUNE.upgB[1] * k);
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function roman(n) { return n <= 10 ? ROMAN[n] : String(n); }
const GLOBAL_UPG = ['Contador esperto', 'Marketing nas redes', 'Consultoria de gestão', 'Lobby em Brasília', 'Fundo de private equity',
  'Holding nas Ilhas Cayman', 'IA que administra tudo', 'Monopólio amigável', 'Banco Central particular', 'Governo mundial'];
const TAP_UPG = ['Lábia de vendedor', 'Maquininha de cartão', 'Pix na hora', 'Megafone', 'Carisma de CEO', 'Palestra motivacional',
  'Assistente pessoal', 'Clone de você', 'Exército de clones', 'Toque de Midas'];
export function upgInfo(chain, k) {
  if (chain === 'g') {
    const name = k < GLOBAL_UPG.length ? GLOBAL_UPG[k] : GLOBAL_UPG[GLOBAL_UPG.length - 1] + ' ' + roman(k - GLOBAL_UPG.length + 2);
    return { emoji: '🌐', name, desc: 'Todos os negócios x3' };
  }
  if (chain === 't') {
    const name = k < TAP_UPG.length ? TAP_UPG[k] : TAP_UPG[TAP_UPG.length - 1] + ' ' + roman(k - TAP_UPG.length + 2);
    return { emoji: '👆', name, desc: k % 2 === 0 ? 'Toques valem x2' : 'Cada toque ganha +1% da renda/s' };
  }
  const b = B[chain];
  const name = k < b.upg.length ? b.upg[k] : 'Expansão ' + roman(k - b.upg.length + 1);
  return { emoji: b.emoji, name, desc: b.name + ' x3' };
}

// ---------- Conquistas ----------
export const ACH = [];
(function buildAch() {
  for (const b of B) for (const c of [25, 100, 250, 500, 1000])
    ACH.push({ id: `b${b.i}_${c}`, emoji: b.emoji, name: `${c} × ${b.name}`, test: s => s.biz[b.i].n >= c });
  for (const m of MARCOS) ACH.push({ id: `m${m.i}`, emoji: m.emoji, name: m.name, test: s => s.lifetimeAll >= m.v });
  for (const c of [100, 1000, 10000, 100000, 1000000]) ACH.push({ id: `tap${c}`, emoji: '👆', name: `${c.toLocaleString('pt-BR')} toques`, test: s => s.st.taps >= c });
  for (const c of [1, 10, 50, 200, 1000]) ACH.push({ id: `mal${c}`, emoji: '💼', name: `${c} maleta${c > 1 ? 's' : ''} de dinheiro`, test: s => s.st.maletas >= c });
  for (const c of [1, 3, 10, 25, 50, 100]) ACH.push({ id: `pr${c}`, emoji: '⭐', name: `Vendeu o império ${c}x`, test: s => s.prestiges >= c });
  for (const c of [1, 5, 10, 24]) ACH.push({ id: `mg${c}`, emoji: '👔', name: `${c} gerente${c > 1 ? 's' : ''}`, test: s => s.biz.filter(x => x.m).length >= c });
  for (const c of [1, 5, 10, 20, LUX.length]) ACH.push({ id: `lx${c}`, emoji: '💎', name: `${c} ite${c > 1 ? 'ns' : 'm'} de luxo`, test: s => s.lux.length >= c });
  for (const c of [1, 10, 50]) ACH.push({ id: `ev${c}`, emoji: '🎲', name: `${c} decis${c > 1 ? 'ões' : 'ão'} difíce${c > 1 ? 'is' : 'il'}`, test: s => s.st.events >= c });
  ACH.push({ id: 'trade2', emoji: '📈', name: 'Dobrou o dinheiro num trade', test: s => s.st.bestTrade >= 2 });
  ACH.push({ id: 'trade10', emoji: '🚀', name: 'Trade de 10x', test: s => s.st.bestTrade >= 10 });
  ACH.push({ id: 'rug', emoji: '💀', name: 'Perdeu metade num trade', test: s => s.st.worstTrade <= 0.5 });
  ACH.push({ id: 'ir', emoji: '🦁', name: 'Pagou imposto de renda', test: s => s.st.tax > 0 });
  for (const h of [1, 10, 100]) ACH.push({ id: `pt${h}`, emoji: '⏱️', name: `${h}h de jogo`, test: s => s.st.play >= h * 3600 });
})();

// ---------- Estado inicial ----------
function rng() { return Math.random(); }
function gauss() { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function freshMarket() {
  const mk = {};
  for (const a of ASSETS) mk[a.id] = { p: a.p, h: [a.p] };
  return mk;
}

export function newState() {
  return {
    v: 1,
    cash: 0,
    lifetime: 0,      // nesta geração
    lifetimeAll: 0,   // em todas
    biz: B.map(() => ({ n: 0, m: false, p: 0, run: false })),
    upg: { g: 0, t: 0, b: B.map(() => 0) },
    lux: [],
    stars: 0, starsClaimed: 0, perks: {},
    prestiges: 0,
    ach: {},
    marcoSeen: 0,
    pos: {},
    mk: freshMarket(),
    boosts: [],
    st: { taps: 0, maletas: 0, events: 0, bestTrade: 0, worstTrade: 1, tax: 0, play: 0, maxIncome: 0, runs: 0, started: Date.now() },
    set: { sound: true, buy: 1, sci: false },
    seen: { tip: 0 },
    last: Date.now(),
  };
}

// ---------- Motor ----------
export class Game {
  constructor(state) {
    this.s = state || newState();
    this.listeners = [];
    this.c = B.map(() => ({ pm: 1, sp: 1, ms: null }));
    this.timers = [];
    this.nextMaleta = 45 + rng() * 40;
    this.nextEvent = 200 + rng() * 160;
    this.nextNews = 25 + rng() * 30;
    this.mkAcc = 0; this.histAcc = 0; this.achAcc = 0;
    this.maleta = null;
    this.event = null;
    this.news = [];
    this.recalcAll();
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data) { for (const f of this.listeners) f(type, data); }

  perk(id) { return this.s.perks[id] || 0; }

  // ----- multiplicadores -----
  recalcBiz(i) {
    const s = this.s, c = this.c[i];
    const ms = milestoneOf(s.biz[i].n);
    c.ms = ms;
    c.pm = ms.profit * Math.pow(3, s.upg.b[i]);
    c.sp = ms.speed * Math.pow(1.25, this.perk('turbo'));
  }
  recalcAll() {
    for (let i = 0; i < B.length; i++) this.recalcBiz(i);
    this.recalcGlobal();
  }
  recalcGlobal() {
    const s = this.s;
    let lux = 1;
    for (const i of s.lux) lux *= LUX[i].mult;
    this.luxMult = lux;
    this.achCount = Object.keys(s.ach).length;
    this.achMult = 1 + 0.02 * this.achCount;
    this.starPct = 0.02 + 0.005 * this.perk('carisma');
    this.starMult = 1 + s.stars * this.starPct;
    this.upgMult = Math.pow(3, s.upg.g);
    this.baseMult = this.luxMult * this.achMult * this.starMult * this.upgMult;
  }
  boostMult(kind = 'p') {
    let m = 1;
    for (const b of this.s.boosts) if (b.k === kind) m *= b.m;
    return m;
  }
  globalMult() { return this.baseMult * this.boostMult('p'); }

  cycleTime(i) { return B[i].t / this.c[i].sp; }
  cycleRev(i, g = this.globalMult()) { return B[i].rev * this.s.biz[i].n * this.c[i].pm * g; }
  bizRate(i, g) { const n = this.s.biz[i].n; return n ? this.cycleRev(i, g) / this.cycleTime(i) : 0; }

  incomeRate(withBoost = true) {
    const g = withBoost ? this.globalMult() : this.baseMult;
    let r = 0;
    for (let i = 0; i < B.length; i++) if (this.s.biz[i].m) r += this.bizRate(i, g);
    return r;
  }

  tapValue() {
    const k = this.s.upg.t;
    const doubles = Math.ceil(k / 2);
    const pct = Math.floor(k / 2) * 0.01;
    const base = Math.pow(2, doubles) * Math.pow(3, this.perk('maos')) * this.baseMult;
    return (base + pct * this.incomeRate(false)) * this.boostMult('p') * this.boostMult('t');
  }

  // ----- dinheiro -----
  earn(x) {
    if (!(x > 0)) return;
    const s = this.s;
    s.cash += x; s.lifetime += x; s.lifetimeAll += x;
  }
  spend(x) {
    if (this.s.cash + 1e-9 < x) return false;
    this.s.cash = Math.max(0, this.s.cash - x);
    return true;
  }

  // ----- negócios -----
  unlockedCount() {
    // quantos negócios aparecem (os possuídos + o próximo)
    let k = 0;
    while (k < B.length && this.s.biz[k].n > 0) k++;
    return Math.min(B.length, k + 1);
  }
  costOf(i, q) {
    const b = B[i], n = this.s.biz[i].n;
    return b.cost * Math.pow(b.r, n) * (Math.pow(b.r, q) - 1) / (b.r - 1);
  }
  maxBuy(i) {
    const b = B[i], n = this.s.biz[i].n;
    const base = b.cost * Math.pow(b.r, n);
    const q = Math.floor(Math.log(this.s.cash * (b.r - 1) / base + 1) / Math.log(b.r));
    return Math.max(0, q);
  }
  buyQty(i) {
    const m = this.s.set.buy;
    if (m === 'max') return Math.max(1, this.maxBuy(i));
    if (m === 'next') {
      const ms = this.c[i].ms;
      return Math.max(1, ms.next - this.s.biz[i].n);
    }
    return m;
  }
  buyBiz(i, q = this.buyQty(i)) {
    if (q <= 0) return false;
    const cost = this.costOf(i, q);
    if (!this.spend(cost)) return false;
    const st = this.s.biz[i];
    const before = this.c[i].ms ? this.c[i].ms.next : 0;
    const wasZero = st.n === 0;
    st.n += q;
    this.recalcBiz(i);
    if (st.n >= before && before > 0) {
      // marcos atingidos
      let k = 0; const hits = [];
      while (msAt(k) <= st.n) { if (msAt(k) > st.n - q) hits.push(msAt(k)); k++; }
      for (const h of hits) this.emit('milestone', { i, at: h, type: msType(h) });
    }
    if (wasZero) this.emit('unlock', { i });
    this.emit('buy', { i, q });
    return true;
  }
  mgrCost(i) { return B[i].mgrCost * Math.pow(0.85, this.perk('rh')); }
  hireMgr(i) {
    const st = this.s.biz[i];
    if (st.m || st.n === 0) return false;
    if (!this.spend(this.mgrCost(i))) return false;
    st.m = true;
    this.emit('mgr', { i });
    return true;
  }
  runBiz(i) {
    const st = this.s.biz[i];
    if (st.n === 0 || st.m || st.run) return false;
    st.run = true;
    this.s.st.runs++;
    return true;
  }

  tap(times = 1) {
    const v = this.tapValue() * times;
    this.earn(v);
    this.s.st.taps += times;
    return v;
  }

  // ----- melhorias -----
  upgCandidates() {
    const s = this.s, list = [];
    list.push({ chain: 't', k: s.upg.t, cost: upgCost('t', s.upg.t) });
    if (s.lifetime > 2e4 || s.upg.g > 0) list.push({ chain: 'g', k: s.upg.g, cost: upgCost('g', s.upg.g) });
    for (let i = 0; i < B.length; i++) if (s.biz[i].n > 0) list.push({ chain: i, k: s.upg.b[i], cost: upgCost(i, s.upg.b[i]) });
    list.sort((a, b) => a.cost - b.cost);
    return list;
  }
  buyUpg(chain) {
    const s = this.s;
    const k = chain === 'g' ? s.upg.g : chain === 't' ? s.upg.t : s.upg.b[chain];
    if (!this.spend(upgCost(chain, k))) return false;
    if (chain === 'g') { s.upg.g++; this.recalcGlobal(); }
    else if (chain === 't') s.upg.t++;
    else { s.upg.b[chain]++; this.recalcBiz(chain); }
    this.emit('upg', { chain, k });
    return true;
  }
  buyAllUpg() {
    let n = 0;
    for (let guard = 0; guard < 500; guard++) {
      const c = this.upgCandidates()[0];
      if (!c || c.cost > this.s.cash) break;
      if (!this.buyUpg(c.chain)) break;
      n++;
    }
    return n;
  }

  // ----- luxo -----
  buyLux(i) {
    const s = this.s;
    if (s.lux.includes(i)) return false;
    if (!this.spend(LUX[i].price)) return false;
    s.lux.push(i);
    this.recalcGlobal();
    this.emit('lux', { i });
    return true;
  }

  // ----- prestígio -----
  starsTotal() { return Math.floor(TUNE.starK * Math.pow(this.s.lifetimeAll / TUNE.starDiv, TUNE.starPow)); }
  starsPending() { return Math.max(0, this.starsTotal() - this.s.starsClaimed); }
  starsNextAt() {
    // ganhos totais necessários para a próxima estrela
    const t = this.starsTotal() + 1;
    return Math.pow(t / TUNE.starK, 1 / TUNE.starPow) * TUNE.starDiv;
  }
  prestige() {
    const s = this.s;
    const gain = this.starsPending();
    if (gain <= 0) return false;
    s.stars += gain;
    s.starsClaimed += gain;
    s.prestiges++;
    // liquida a carteira
    s.pos = {};
    s.cash = this.perk('heranca') > 0 ? 1000 * Math.pow(10, this.perk('heranca') - 1) * 2 : 0;
    s.lifetime = 0;
    s.biz = B.map(() => ({ n: 0, m: false, p: 0, run: false }));
    const freeMgr = this.perk('escola');
    for (let i = 0; i < freeMgr && i < B.length; i++) s.biz[i].m = true;
    s.upg = { g: 0, t: 0, b: B.map(() => 0) };
    s.lux = [];
    s.boosts = [];
    this.recalcAll();
    this.emit('prestige', { gain });
    return true;
  }
  buyPerk(id) {
    const p = PERKS.find(x => x.id === id);
    const l = this.perk(id);
    if (!p || l >= p.max) return false;
    const c = p.cost(l);
    if (this.s.stars < c) return false;
    this.s.stars -= c;
    this.s.perks[id] = l + 1;
    if (id === 'escola') { for (let i = 0; i < l + 1 && i < B.length; i++) if (this.s.biz[i].n > 0 || i <= l) this.s.biz[i].m = true; }
    this.recalcAll();
    this.emit('perk', { id });
    return true;
  }

  // ----- bolsa -----
  posValue(id) { const p = this.s.pos[id]; return p ? p.sh * this.s.mk[id].p : 0; }
  portfolio() { let v = 0; for (const id in this.s.pos) v += this.posValue(id); return v; }
  netWorth() { return this.s.cash + this.portfolio(); }
  invest(id, frac) {
    const amt = this.s.cash * frac;
    if (amt < 1) return false;
    this.spend(amt);
    const p = this.s.pos[id] || (this.s.pos[id] = { sh: 0, cost: 0 });
    p.sh += amt / this.s.mk[id].p;
    p.cost += amt;
    this.emit('trade', { id, buy: amt });
    return amt;
  }
  sell(id, frac) {
    const p = this.s.pos[id];
    if (!p || p.sh <= 0) return false;
    const sh = p.sh * frac;
    const gross = sh * this.s.mk[id].p;
    const basis = p.cost * frac;
    const gain = gross - basis;
    const tax = gain > 0 ? gain * 0.15 : 0;
    const net = gross - tax;
    p.sh -= sh; p.cost -= basis;
    if (frac >= 0.999 || p.sh <= 1e-12) delete this.s.pos[id];
    // o principal volta ao caixa; o lucro conta como ganho
    this.s.cash += Math.min(net, basis);
    if (net > basis) this.earn(net - basis);
    const ratio = basis > 0 ? gross / basis : 1;
    const st = this.s.st;
    st.bestTrade = Math.max(st.bestTrade, ratio);
    st.worstTrade = Math.min(st.worstTrade, ratio);
    st.tax += tax;
    this.emit('trade', { id, sell: net, gain: gain - tax, tax });
    return { net, gain: gain - tax, tax };
  }
  stepMarket(h) {
    // h segundos de mercado
    for (const a of ASSETS) {
      const m = this.s.mk[a.id];
      const muS = Math.log(1 + a.mu) / 3600;
      const sig = a.vol / Math.sqrt(60);
      let lp = (muS - 0.5 * sig * sig) * h + sig * Math.sqrt(h) * gauss();
      if (a.jumps && rng() < h / 400) {
        const up = rng() < 0.5;
        lp += up ? Math.log(1.4 + rng() * 1.2) : Math.log(0.3 + rng() * 0.3);
        if (h < 5) this.pushNews((up ? NEWS.dogUp : NEWS.dogDown)[Math.floor(rng() * 3)], a.id, up);
      }
      m.p = Math.max(1e-6, m.p * Math.exp(lp));
    }
  }
  pushNews(text, id, up) {
    const n = { text, id, up, t: Date.now() };
    this.news.unshift(n);
    if (this.news.length > 12) this.news.pop();
    this.emit('news', n);
  }
  randomNews() {
    const pool = ASSETS.filter(a => a.kind === 'Ação' || a.kind === 'BDR');
    const a = pool[Math.floor(rng() * pool.length)];
    const up = rng() < 0.55;
    const size = 0.03 + rng() * 0.1;
    this.s.mk[a.id].p *= up ? 1 + size : 1 - size;
    const list = up ? NEWS.up : NEWS.down;
    this.pushNews(list[Math.floor(rng() * list.length)].replace('{n}', a.name), a.id, up);
  }
  pushHist() {
    for (const a of ASSETS) {
      const m = this.s.mk[a.id];
      m.h.push(m.p);
      if (m.h.length > 120) m.h.shift();
    }
  }

  // ----- maletas e eventos -----
  clickMaleta() {
    if (!this.maleta) return null;
    this.maleta = null;
    this.s.st.maletas++;
    const r = rng();
    let out;
    if (r < 0.48) {
      const inc = Math.max(this.incomeRate(), this.tapValue() * 3);
      const v = Math.max(this.tapValue() * 60, Math.min(this.s.cash * 0.3 + inc * 60, inc * 900));
      this.earn(v);
      out = { kind: 'cash', v, text: 'Maleta cheia de dinheiro!' };
    } else if (r < 0.85) {
      this.addBoost('p', 7, 30, '💼 Frenesi');
      out = { kind: 'frenzy', text: 'Frenesi! Lucro x7 por 30s' };
    } else {
      this.addBoost('t', 50, 20, '👆 Dedo de ouro');
      out = { kind: 'tap', text: 'Dedo de ouro! Toques x50 por 20s' };
    }
    this.emit('maletaOpen', out);
    return out;
  }
  addBoost(k, m, secs, label) {
    this.s.boosts.push({ k, m, until: Date.now() + secs * 1000, dur: secs, label });
    this.emit('boost', {});
  }
  resolveEvent(optIdx) {
    const ev = this.event;
    if (!ev) return;
    this.event = null;
    this.s.st.events++;
    const opt = ev.opts[optIdx];
    const c0 = this.s.cash;
    const run = (fx) => {
      for (const f of fx) {
        const [t, a, b, c] = f;
        if (t === 'cash' || t === 'cashAbs') {
          if (a < 0) this.s.cash = Math.max(0, this.s.cash + c0 * a);
          else this.earn(c0 * a);
        } else if (t === 'boost') this.addBoost('p', a, b, c);
        else if (t === 'income') this.earn(Math.max(this.incomeRate(false), this.tapValue()) * a);
        else if (t === 'msg') this.emit('toast', { text: a });
        else if (t === 'gamble') run(rng() < a ? b : c);
        else if (t === 'tip') {
          const pool = ASSETS.filter(x => x.kind === 'Ação' || x.kind === 'BDR');
          const as = pool[Math.floor(rng() * pool.length)];
          this.invest(as.id, a);
          const good = rng() < 0.6;
          this.emit('toast', { text: `🤫 Comprou ${as.tk}. Agora é torcer...` });
          this.timers.push({ at: 12, fn: () => {
            this.s.mk[as.id].p *= good ? 1.22 + rng() * 0.15 : 0.82 - rng() * 0.08;
            this.pushNews(good ? `${as.name} dispara após anúncio surpresa` : `${as.name} despenca: a dica era furada`, as.id, good);
          } });
        }
      }
    };
    run(opt.fx);
    this.emit('eventDone', {});
  }

  // ----- conquistas -----
  checkAch() {
    const s = this.s;
    let changed = false;
    for (const a of ACH) {
      if (!s.ach[a.id] && a.test(s)) {
        s.ach[a.id] = Date.now();
        changed = true;
        this.emit('ach', a);
      }
    }
    if (changed) this.recalcGlobal();
    // marcos de fortuna
    let k = 0;
    while (k < MARCOS.length && s.lifetimeAll >= MARCOS[k].v) k++;
    if (k > s.marcoSeen) {
      for (let j = s.marcoSeen; j < k; j++) this.emit('marco', MARCOS[j]);
      s.marcoSeen = k;
    }
  }

  // ----- laço principal -----
  tick(dt) {
    const s = this.s;
    s.st.play += dt;
    const now = Date.now();
    // boosts expirados
    if (s.boosts.length) {
      const before = s.boosts.length;
      s.boosts = s.boosts.filter(b => b.until > now);
      if (s.boosts.length !== before) this.emit('boost', {});
    }
    const g = this.globalMult();
    for (let i = 0; i < B.length; i++) {
      const st = s.biz[i];
      if (st.n === 0) continue;
      const T = this.cycleTime(i);
      if (st.m) {
        if (T < 0.15) {
          this.earn(this.cycleRev(i, g) / T * dt);
          st.p = (st.p + dt / T) % 1;
        } else {
          st.p += dt / T;
          if (st.p >= 1) {
            const k = Math.floor(st.p);
            st.p -= k;
            this.earn(this.cycleRev(i, g) * k);
            this.emit('cycle', { i });
          }
        }
      } else if (st.run) {
        st.p += dt / T;
        if (st.p >= 1) {
          st.p = 0; st.run = false;
          const v = this.cycleRev(i, g);
          this.earn(v);
          this.emit('done', { i, v });
        }
      }
    }
    // bolsa
    this.mkAcc += dt;
    if (this.mkAcc >= 1) { this.stepMarket(this.mkAcc); this.mkAcc = 0; }
    this.histAcc += dt;
    if (this.histAcc >= 3) { this.histAcc = 0; this.pushHist(); }
    this.nextNews -= dt;
    if (this.nextNews <= 0) { this.nextNews = 35 + rng() * 50; this.randomNews(); }
    // timers
    if (this.timers.length) {
      for (const t of this.timers) t.at -= dt;
      const due = this.timers.filter(t => t.at <= 0);
      this.timers = this.timers.filter(t => t.at > 0);
      for (const t of due) t.fn();
    }
    // maleta
    this.nextMaleta -= dt;
    if (this.nextMaleta <= 0) {
      this.nextMaleta = (70 + rng() * 110) / (1 + 0.2 * this.perk('faro'));
      if (s.lifetimeAll > 50) { this.maleta = { born: now, x: 0.15 + rng() * 0.7, y: 0.3 + rng() * 0.4 }; this.emit('maleta', this.maleta); }
    }
    if (this.maleta && now - this.maleta.born > 13000) { this.maleta = null; this.emit('maletaGone', {}); }
    // eventos
    if (!this.event && s.biz[0].m) {
      this.nextEvent -= dt;
      if (this.nextEvent <= 0) {
        this.nextEvent = 220 + rng() * 260;
        this.event = EVENTS[Math.floor(rng() * EVENTS.length)];
        this.emit('event', this.event);
      }
    }
    this.achAcc += dt;
    if (this.achAcc >= 1) {
      this.achAcc = 0;
      this.checkAch();
      const r = this.incomeRate(false);
      if (r > s.st.maxIncome) s.st.maxIncome = r;
    }
  }

  // Tempo fora do jogo (app fechado ou em segundo plano)
  offline(secs) {
    const s = this.s;
    const cap = (2 + 2 * this.perk('sono')) * 3600;
    const eff = Math.min(secs, cap);
    // boosts acabam
    s.boosts = s.boosts.filter(b => b.until > Date.now());
    const g = this.baseMult;
    let earned = 0;
    for (let i = 0; i < B.length; i++) {
      const st = s.biz[i];
      if (!st.n) continue;
      if (st.m) earned += this.bizRate(i, g) * eff;
      else if (st.run) {
        st.p += secs / this.cycleTime(i);
        if (st.p >= 1) { st.p = 0; st.run = false; earned += this.cycleRev(i, g); }
      }
    }
    this.earn(earned);
    // mercado
    const before = this.portfolio();
    const msecs = Math.min(secs, 6 * 3600);
    let left = msecs;
    while (left > 0) { const h = Math.min(30, left); this.stepMarket(h); left -= h; }
    if (msecs > 60) this.pushHist();
    const after = this.portfolio();
    s.st.play += 0;
    this.checkAch();
    return { secs, eff, capped: secs > cap, earned, mkDelta: after - before };
  }

  toJSON() { this.s.last = Date.now(); return JSON.stringify(this.s); }
  static load(str) {
    try {
      const s = JSON.parse(str);
      const base = newState();
      const merged = Object.assign(base, s);
      merged.st = Object.assign(newState().st, s.st || {});
      merged.set = Object.assign(newState().set, s.set || {});
      // garante tamanhos
      while (merged.biz.length < B.length) merged.biz.push({ n: 0, m: false, p: 0, run: false });
      while (merged.upg.b.length < B.length) merged.upg.b.push(0);
      for (const a of ASSETS) if (!merged.mk[a.id]) merged.mk[a.id] = { p: a.p, h: [a.p] };
      return new Game(merged);
    } catch (e) {
      return null;
    }
  }
}
