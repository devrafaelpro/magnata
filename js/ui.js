// Interface: HUD, abas, cartões, modais, toasts e efeitos.
import { B, ACH, upgInfo, msType } from './engine.js';
import { LUX, MARCOS, PERKS, ASSETS, ERAS } from './data.js';
import { money, num, pct, time, mult, setScientific } from './fmt.js';
import { sfx, haptic, Sky, FX, setSound } from './fx.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Lista com chave: só reconstrói o HTML quando a estrutura muda.
function keyed(box, items) {
  const keys = items.map(it => it.key).join('|');
  if (box._keys !== keys) {
    box.innerHTML = items.map(it => it.html()).join('');
    box._keys = keys;
  }
  const els = box.children;
  for (let k = 0; k < items.length; k++) if (items[k].update) items[k].update(els[k]);
}
function setText(el, v) { if (el && el._t !== v) { el.textContent = v; el._t = v; } }
function setCls(el, c, on) { if (el && el.classList.contains(c) !== on) el.classList.toggle(c, on); }

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export class UI {
  constructor(game, hooks) {
    this.g = game;
    this.hooks = hooks; // { save, reset, importSave }
    this.tab = 'biz';
    this.mgmtSeg = 'mgr';
    this.openAsset = null;
    this.modalQ = [];
    this.modalOpen = false;
    this.acc = 0; this.slowAcc = 0;
    this.sky = new Sky($('#sky'));
    this.fx = new FX($('#fx'));
    this.maletaEl = null;
    this.deferredInstall = null;
    this.buildTabs();
    this.bindFab();
    this.bindGame();
    setScientific(game.s.set.sci);
    setSound(game.s.set.sound);
    this.updateSoundBtn();
    $('#btnSound').onclick = () => { game.s.set.sound = !game.s.set.sound; setSound(game.s.set.sound); this.updateSoundBtn(); };
    $('#btnStars').onclick = () => this.setTab('empire');
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferredInstall = e; });
    this.setTab('biz');
  }

  updateSoundBtn() { $('#btnSound').textContent = this.g.s.set.sound ? '🔊' : '🔇'; }

  // ---------- Abas ----------
  buildTabs() {
    const tabs = [['biz', '🏪', 'Negócios'], ['mgmt', '👔', 'Gestão'], ['invest', '📈', 'Investir'], ['lux', '💎', 'Luxo'], ['empire', '👑', 'Império']];
    $('#tabs').innerHTML = tabs.map(([id, e, n]) => `<button data-tab="${id}"><span class="e">${e}</span>${n}<i class="dot"></i></button>`).join('');
    $('#tabs').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-tab]');
      if (b) { this.setTab(b.dataset.tab); sfx.done(); }
    });
    // Negócios
    $('#tab-biz').innerHTML = `
      <div id="hint"></div>
      <div class="sticky"><div class="seg" id="buySeg">
        <button data-buy="1">x1</button><button data-buy="10">x10</button><button data-buy="100">x100</button><button data-buy="next">Marco</button><button data-buy="max">MÁX</button>
      </div></div>
      <div id="bizList"></div>`;
    $('#buySeg').addEventListener('click', e => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      const v = b.dataset.buy;
      this.g.s.set.buy = isNaN(+v) ? v : +v;
      sfx.done();
      this.updateBuySeg();
    });
    this.updateBuySeg();
    const bizList = $('#bizList');
    bizList.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      const i = +a.dataset.i;
      if (a.dataset.act === 'run') {
        if (this.g.runBiz(i)) { sfx.done(); haptic(6); }
      } else if (a.dataset.act === 'hire') {
        if (this.g.s.biz[i].m) return;
        if (this.g.hireMgr(i)) { sfx.buy(); haptic(15); } else { sfx.error(); this.toast('👔', 'Dinheiro insuficiente para o gerente', money(this.g.mgrCost(i))); }
      }
    });
    this.bindHoldBuy(bizList);

    // Gestão
    $('#tab-mgmt').innerHTML = `
      <div class="sticky"><div class="seg" id="mgmtSeg"><button data-seg="mgr">👔 Gerentes</button><button data-seg="upg">🚀 Melhorias</button></div></div>
      <div id="mgrWrap"><div class="hint"><span class="e">👔</span><span>Gerentes fazem seus negócios rodarem sozinhos, <b>até com o app fechado</b>.</span></div><div id="mgrList"></div></div>
      <div id="upgWrap"><button class="btn block green" id="buyAll" style="margin-bottom:10px">Comprar todas as possíveis</button><div id="upgList"></div></div>`;
    $('#mgmtSeg').addEventListener('click', e => {
      const b = e.target.closest('[data-seg]'); if (!b) return;
      this.mgmtSeg = b.dataset.seg; sfx.done(); this.renderMgmt(true);
    });
    $('#tab-mgmt').addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'hire') {
        if (this.g.hireMgr(+a.dataset.i)) { sfx.buy(); haptic(15); } else sfx.error();
      } else if (a.dataset.act === 'upg') {
        const c = a.dataset.c; const chain = c === 'g' || c === 't' ? c : +c;
        if (this.g.buyUpg(chain)) { sfx.buy(); haptic(15); } else sfx.error();
      }
      this.renderMgmt(true);
    });
    $('#buyAll').onclick = () => {
      const n = this.g.buyAllUpg();
      if (n) { sfx.milestone(); this.toast('🚀', `${n} melhoria${n > 1 ? 's' : ''} comprada${n > 1 ? 's' : ''}!`); } else sfx.error();
      this.renderMgmt(true);
    };

    // Investir
    $('#tab-invest').innerHTML = `
      <div class="card"><div class="port">
        <div><div class="k">Carteira</div><div class="v" id="pfVal">R$ 0</div></div>
        <div><div class="k">Lucro / prejuízo</div><div class="v" id="pfPl">R$ 0</div></div>
      </div><div class="news" id="newsList"></div></div>
      <h2 class="sec">Mercado</h2>
      <div id="assetList"></div>
      <p class="muted small" style="text-align:center;margin:14px 8px">Os preços andam mesmo com o app fechado (até 6h). Na venda com lucro, você paga 15% de IR. Ao vender o império, a carteira é zerada.</p>`;
    $('#assetList').addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      const card = e.target.closest('.asset');
      if (!card) return;
      const id = card.dataset.id;
      if (!a) { this.openAsset = this.openAsset === id ? null : id; sfx.done(); this.renderInvest(true); return; }
      const f = +a.dataset.f;
      if (a.dataset.act === 'buy') {
        const amt = this.g.invest(id, f);
        if (amt) { sfx.trade(); haptic(10); this.toast('📈', `Comprou ${money(amt)} em ${ASSETS.find(x => x.id === id).tk}`); } else sfx.error();
      } else if (a.dataset.act === 'sell') {
        const r = this.g.sell(id, f);
        if (r) {
          sfx.trade(); haptic(10);
          const tk = ASSETS.find(x => x.id === id).tk;
          if (r.gain >= 0) { sfx.cash(); this.toast('💰', `Vendeu ${tk} com lucro de ${money(r.gain)}`, r.tax > 0 ? `IR pago: ${money(r.tax)}` : ''); }
          else this.toast('📉', `Vendeu ${tk} com prejuízo de ${money(-r.gain)}`);
        } else sfx.error();
      }
      this.renderInvest(true);
    });

    // Luxo
    $('#tab-lux').innerHTML = `
      <div class="card" style="text-align:center;margin-bottom:12px">
        <div class="muted small">Seu estilo de vida multiplica todo o lucro</div>
        <div style="font-size:30px;font-weight:900;margin-top:4px" class="gold" id="luxMult">x1</div>
        <div class="muted small" id="luxCount"></div>
      </div>
      <div class="lux-grid" id="luxGrid"></div>
      <p class="muted small" style="text-align:center;margin:14px 8px">Itens de luxo ficam com o império: quando você vende tudo, eles vão junto.</p>`;
    $('#luxGrid').addEventListener('click', e => {
      const a = e.target.closest('[data-act="lux"]'); if (!a) return;
      const i = +a.dataset.i;
      if (this.g.buyLux(i)) {
        sfx.milestone(); haptic(25);
        const r = a.getBoundingClientRect();
        this.fx.burst(r.left + r.width / 2, r.top, [LUX[i].emoji, '✨', '💎'], 14);
      } else sfx.error();
      this.renderLux(true);
    });

    // Império
    $('#tab-empire').innerHTML = `
      <div id="install"></div>
      <div class="prest">
        <div class="muted small" style="text-transform:uppercase;letter-spacing:.14em;font-weight:800">Reputação</div>
        <div class="big"><span class="gold">⭐</span> <span id="pStars">0</span></div>
        <div class="sub" id="pBonus"></div>
        <div class="gain" id="pGain"></div>
        <button class="btn violet block" id="btnPrestige">Vender o império</button>
        <div class="muted small" style="margin-top:10px" id="pNext"></div>
      </div>
      <h2 class="sec">Talentos <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:600">· pagos com ⭐</span></h2>
      <p class="muted small" style="margin:-4px 4px 8px">Estrelas gastas em talentos deixam de dar o bônus de lucro. Escolha bem.</p>
      <div id="perkList"></div>
      <h2 class="sec">Marcos da fortuna</h2>
      <div class="card marcos" id="marcoList"></div>
      <h2 class="sec">Conquistas <span id="achCount" class="muted" style="letter-spacing:0"></span></h2>
      <div class="ach-grid" id="achGrid"></div>
      <h2 class="sec">Estatísticas</h2>
      <div class="stats" id="stats"></div>
      <h2 class="sec">Configurações</h2>
      <div class="card" id="settings">
        <div class="row" style="padding:6px 0"><span class="grow">🔊 Sons</span><button class="toggle" data-set="sound"></button></div>
        <div class="row" style="padding:6px 0"><span class="grow">🔬 Notação científica</span><button class="toggle" data-set="sci"></button></div>
        <div class="row" style="gap:8px;margin-top:10px">
          <button class="btn ghost sm grow" id="btnExport">Exportar save</button>
          <button class="btn ghost sm grow" id="btnImport">Importar save</button>
        </div>
        <button class="btn red sm block" style="margin-top:10px;height:38px" id="btnReset">Apagar todo o progresso</button>
      </div>
      <p class="muted small" style="text-align:center;margin:18px 0 6px">Magnata · feito com ☕ e ambição</p>`;
    $('#btnPrestige').onclick = () => this.confirmPrestige();
    $('#perkList').addEventListener('click', e => {
      const a = e.target.closest('[data-perk]'); if (!a) return;
      if (this.g.buyPerk(a.dataset.perk)) { sfx.milestone(); haptic(20); } else sfx.error();
      this.renderEmpire(true);
    });
    $('#achGrid').addEventListener('click', e => {
      const a = e.target.closest('[data-ach]'); if (!a) return;
      const x = ACH[+a.dataset.ach];
      const ok = this.g.s.ach[x.id];
      this.toast(x.emoji, ok ? x.name : '???', ok ? 'Conquistada · +2% de lucro' : 'Conquista bloqueada');
    });
    $('#settings').addEventListener('click', e => {
      const t = e.target.closest('[data-set]'); if (!t) return;
      const k = t.dataset.set;
      this.g.s.set[k] = !this.g.s.set[k];
      if (k === 'sound') { setSound(this.g.s.set.sound); this.updateSoundBtn(); }
      if (k === 'sci') setScientific(this.g.s.set.sci);
      this.renderEmpire(true);
    });
    $('#btnExport').onclick = () => {
      const code = btoa(unescape(encodeURIComponent(this.g.toJSON())));
      this.modal({ e: '💾', title: 'Exportar save', text: 'Copie o código abaixo e guarde. Ele restaura seu império em qualquer aparelho.',
        html: `<textarea readonly id="exp">${code}</textarea>`, buttons: [
          { label: 'Copiar', cls: 'green', keep: true, fn: () => { navigator.clipboard?.writeText(code).then(() => this.toast('📋', 'Copiado!')).catch(() => { $('#exp').select(); }); } },
          { label: 'Fechar', cls: 'ghost' }] });
    };
    $('#btnImport').onclick = () => {
      this.modal({ e: '📥', title: 'Importar save', text: 'Cole o código exportado. Seu progresso atual será substituído.',
        html: `<textarea id="imp" placeholder="Cole aqui"></textarea>`, buttons: [
          { label: 'Importar', cls: 'green', fn: () => this.hooks.importSave($('#imp').value.trim()) },
          { label: 'Cancelar', cls: 'ghost' }] });
    };
    $('#btnReset').onclick = () => {
      this.modal({ e: '🔥', title: 'Apagar tudo?', text: 'Isso apaga todo o progresso, estrelas e conquistas. Não dá para desfazer.', buttons: [
        { label: 'Sim, começar do zero', cls: 'red', fn: () => this.hooks.reset() },
        { label: 'Cancelar', cls: 'ghost' }] });
    };
    $('#install').addEventListener('click', e => {
      if (e.target.closest('#btnInstall') && this.deferredInstall) { this.deferredInstall.prompt(); this.deferredInstall = null; }
    });
  }

  setTab(t) {
    this.tab = t;
    document.body.classList.toggle('on-biz', t === 'biz');
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('on', el.id === 'tab-' + t));
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('#main').scrollTop = 0;
    this.renderActive(true);
  }
  updateBuySeg() {
    const v = String(this.g.s.set.buy);
    document.querySelectorAll('#buySeg button').forEach(b => b.classList.toggle('on', b.dataset.buy === v));
  }

  // compra segurando o botão
  bindHoldBuy(box) {
    let timer = null, rep = null, idx = -1, count = 0;
    const stop = () => { clearTimeout(timer); clearInterval(rep); timer = rep = null; idx = -1; };
    const doBuy = () => {
      if (idx < 0) return;
      const q = this.g.buyQty(idx);
      if (this.g.buyBiz(idx, q)) {
        count++;
        sfx.buy(); haptic(8);
        const btn = box.querySelector(`.buy[data-i="${idx}"]`);
        if (btn) { const r = btn.getBoundingClientRect(); this.fx.float(r.left + r.width / 2, r.top, '+' + q, 'green'); }
      } else {
        if (count === 0) { sfx.error(); }
        stop();
      }
      this.renderBiz(true);
    };
    box.addEventListener('pointerdown', e => {
      const b = e.target.closest('.buy'); if (!b) return;
      e.preventDefault();
      idx = +b.dataset.i; count = 0;
      doBuy();
      timer = setTimeout(() => { rep = setInterval(doBuy, 90); }, 380);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => box.addEventListener(t, stop));
    box.addEventListener('scroll', stop, { passive: true });
  }

  // ---------- Botão de trabalhar ----------
  bindFab() {
    const fab = $('#fab');
    fab.innerHTML = `<span class="e">💰</span><span class="v" id="fabV">+R$ 1</span>`;
    fab.addEventListener('pointerdown', e => {
      e.preventDefault();
      const v = this.g.tap(1);
      sfx.tap(); haptic(5);
      fab.classList.add('press');
      setTimeout(() => fab.classList.remove('press'), 70);
      const x = e.clientX || (fab.getBoundingClientRect().left + 40), y = e.clientY || (fab.getBoundingClientRect().top);
      this.fx.float(x - 20 + Math.random() * 40, y - 30, '+' + money(v));
      if (Math.random() < 0.5) {
        const c = $('#hudCash').getBoundingClientRect();
        this.fx.coins(x, y, c.left + c.width / 2, c.top + c.height / 2, 1, Math.random() < 0.5 ? '🪙' : '💵');
      }
    });
    fab.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ---------- Eventos do motor ----------
  bindGame() {
    const g = this.g;
    g.on((type, d) => {
      switch (type) {
        case 'milestone': {
          const b = B[d.i];
          const ty = d.type === 'speed' ? '⚡ Velocidade x2' : d.type === 'x3' ? '💰 Lucro x3' : '💰 Lucro x2';
          this.toast(b.emoji, `${b.name}: ${d.at} unidades!`, ty);
          sfx.milestone();
          break;
        }
        case 'unlock': {
          const b = B[d.i];
          if (d.i > 0) this.toast(b.emoji, `Novo negócio: ${b.name}`, b.desc);
          this.checkEra();
          break;
        }
        case 'mgr': this.toast(B[d.i].mgrEmoji, `${B[d.i].mgr} foi contratado!`, `${B[d.i].name} agora roda sozinho`); break;
        case 'done': {
          if (this.tab !== 'biz') break;
          const el = document.querySelector(`#bizList .biz[data-i="${d.i}"] .bar`);
          if (el) { const r = el.getBoundingClientRect(); this.fx.float(r.left + r.width * 0.3, r.top, '+' + money(d.v), 'green'); }
          sfx.cash();
          break;
        }
        case 'cycle': {
          if (this.tab !== 'biz' || this.g.cycleTime(d.i) < 1.2) break;
          const el = document.querySelector(`#bizList .biz[data-i="${d.i}"] .bar`);
          if (el) { const r = el.getBoundingClientRect(); if (r.top > 0 && r.top < innerHeight) this.fx.float(r.left + r.width * 0.3, r.top, '+' + money(this.g.cycleRev(d.i)), 'green'); }
          break;
        }
        case 'ach': this.toast(d.emoji, `Conquista: ${d.name}`, '+2% de lucro para sempre', 'tach'); sfx.ach(); break;
        case 'marco': this.onMarco(d); break;
        case 'toast': this.toast('💬', d.text); break;
        case 'news': if (this.tab !== 'invest' && this.g.s.pos[d.id]) this.toast(d.up ? '📈' : '📉', d.text, 'Você tem essa na carteira', d.up ? 'news-up' : 'news-down'); break;
        case 'maleta': this.showMaleta(d); break;
        case 'maletaGone': this.hideMaleta(); break;
        case 'event': this.showEvent(d); break;
        case 'prestige': break;
      }
    });
  }

  onMarco(m) {
    this.fx.flash();
    const r = $('#hudCash').getBoundingClientRect();
    this.fx.burst(r.left + r.width / 2, r.top + r.height / 2);
    sfx.ach();
    if (m.v >= 1e6) {
      this.modal({ e: m.emoji, title: m.name, text: `Você já ganhou <b>${money(m.v)}</b> na vida. Bem-vindo a um novo patamar.`,
        buttons: [{ label: 'Bora pra cima! 🚀', cls: 'green' }] });
    } else this.toast(m.emoji, `Marco: ${m.name}`, `Ganhou ${money(m.v)} na vida`);
  }

  checkEra() {
    const s = this.g.s;
    const hi = this.highestOwned();
    const era = this.eraIndex(hi);
    s.seen.era = s.seen.era || 0;
    if (era > s.seen.era) {
      s.seen.era = era;
      const names = ['', '🏘️', '🏙️', '🇧🇷', '🌎', '🚀', '♾️'];
      this.modal({ e: names[era] || '✨', title: `Nova era: ${ERAS[era].name}`, text: 'Seu império subiu de patamar. O horizonte mudou, e as cifras também.', buttons: [{ label: 'Continuar', cls: 'green' }] });
      sfx.prestige();
    }
  }
  highestOwned() { let hi = -1; this.g.s.biz.forEach((b, i) => { if (b.n > 0) hi = i; }); return hi; }
  eraIndex(hi) { let e = 0; ERAS.forEach((x, i) => { if (hi >= x.from) e = i; }); return e; }

  // ---------- Maleta ----------
  showMaleta(m) {
    this.hideMaleta(true);
    const main = $('#main').getBoundingClientRect();
    const el = document.createElement('button');
    el.className = 'maleta'; el.textContent = '💼';
    el.style.left = (main.left + main.width * m.x) + 'px';
    el.style.top = (main.top + main.height * m.y) + 'px';
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const out = this.g.clickMaleta();
      if (!out) return;
      const r = el.getBoundingClientRect();
      this.fx.burst(r.left + r.width / 2, r.top + r.height / 2);
      this.fx.flash();
      sfx.maleta(); haptic(30);
      this.toast('💼', out.text, out.kind === 'cash' ? '+' + money(out.v) : '');
      if (out.kind === 'cash') this.fx.float(r.left + r.width / 2, r.top, '+' + money(out.v));
      el.remove(); this.maletaEl = null;
    });
    $('#fx').appendChild(el);
    this.maletaEl = el;
  }
  hideMaleta(now) {
    const el = this.maletaEl; if (!el) return;
    this.maletaEl = null;
    if (now) { el.remove(); return; }
    el.classList.add('leaving'); setTimeout(() => el.remove(), 600);
  }

  // ---------- Evento ----------
  showEvent(ev) {
    sfx.event(); haptic(20);
    this.modal({ e: ev.emoji, title: ev.title, text: ev.text, noClose: true,
      buttons: ev.opts.map((o, k) => ({ label: o.label, sub: o.sub, cls: k === 0 ? 'green' : 'ghost', fn: () => this.g.resolveEvent(k) })) });
  }

  // ---------- Modal ----------
  modal(opts) {
    if (this.modalOpen) { this.modalQ.push(opts); return; }
    this.modalOpen = true;
    const m = $('#modal');
    m.innerHTML = `<div class="sheet">
      ${opts.e ? `<div class="e">${opts.e}</div>` : ''}
      <h3>${opts.title || ''}</h3>
      ${opts.big ? `<div class="big">${opts.big}</div>` : ''}
      ${opts.text ? `<p>${opts.text}</p>` : ''}
      ${opts.html || ''}
      <div class="btns">${(opts.buttons || [{ label: 'OK', cls: 'green' }]).map((b, k) =>
        `<button class="btn ${b.cls || ''}" data-k="${k}">${b.label}${b.sub ? `<small>${b.sub}</small>` : ''}</button>`).join('')}</div>
    </div>`;
    m.hidden = false;
    const btns = opts.buttons || [{ label: 'OK' }];
    m.onclick = e => {
      const b = e.target.closest('[data-k]');
      if (!b) { if (e.target === m && !opts.noClose) this.closeModal(); return; }
      const def = btns[+b.dataset.k];
      if (!def.keep) this.closeModal();
      def.fn && def.fn();
    };
  }
  closeModal() {
    const m = $('#modal');
    m.hidden = true; m.innerHTML = ''; m.onclick = null;
    this.modalOpen = false;
    if (this.modalQ.length) setTimeout(() => this.modal(this.modalQ.shift()), 180);
  }

  // ---------- Toast ----------
  toast(e, text, small = '', cls = '') {
    const box = $('#toasts');
    while (box.children.length >= 3) box.lastElementChild.remove();
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.innerHTML = `<span class="e">${e}</span><div>${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</div>`;
    box.prepend(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, 2600);
  }

  offlineReport(r) {
    if (r.earned < 1 && Math.abs(r.mkDelta) < 1) return;
    const lines = [`Você ficou fora por <b>${time(r.secs)}</b>.`];
    if (r.capped) lines.push(`Seus gerentes trabalharam ${time(r.eff)} (limite atual). Aumente com o talento 😴 Sono Tranquilo.`);
    if (Math.abs(r.mkDelta) >= 1) lines.push(`Sua carteira ${r.mkDelta >= 0 ? 'subiu' : 'caiu'} <b class="${r.mkDelta >= 0 ? 'green' : 'red'}">${money(Math.abs(r.mkDelta))}</b>.`);
    this.modal({ e: '🌙', title: 'Enquanto você estava fora...', big: '+' + money(r.earned), text: lines.join('<br>'),
      buttons: [{ label: 'Coletar 💰', cls: 'green', fn: () => { const c = $('#hudCash').getBoundingClientRect(); this.fx.burst(c.left + c.width / 2, c.top + 20); sfx.maleta(); } }] });
  }

  confirmPrestige() {
    const g = this.g;
    const gain = g.starsPending();
    if (gain <= 0) { sfx.error(); this.toast('⭐', 'Você ainda não tem reputação para ganhar', `Próxima ⭐ com ${money(g.starsNextAt())} ganhos na vida`); return; }
    const newBonus = (g.s.stars + gain) * g.starPct;
    this.modal({ e: '🏛️', title: 'Vender o império?', big: `+${num(gain)} ⭐`,
      text: `Você vende tudo para um fundo estrangeiro e começa de novo, com a fama de quem já chegou lá.<br><br>
        <b>Perde:</b> dinheiro, negócios, gerentes, melhorias, luxo e carteira.<br>
        <b>Mantém:</b> estrelas, talentos, conquistas e marcos.<br><br>
        Bônus de lucro: <b class="gold">+${num(g.s.stars * g.starPct * 100)}%</b> → <b class="green">+${num(newBonus * 100)}%</b>`,
      buttons: [
        { label: 'Vender e recomeçar 🚀', cls: 'violet', fn: () => {
          g.prestige(); sfx.prestige(); this.fx.flash();
          const c = $('#hudCash').getBoundingClientRect();
          this.fx.burst(c.left + c.width / 2, c.top + 20, ['⭐', '✨', '💫', '🌟'], 24);
          this.hideMaleta(true);
          this.sky.setLevel(0, 0);
          this.setTab('biz');
          this.hooks.save();
        } },
        { label: 'Ainda não', cls: 'ghost' }] });
  }

  // ---------- Renderização ----------
  frame(dt, t) {
    this.sky.draw(t);
    this.updateBars();
    this.acc += dt;
    if (this.acc >= 0.1) { this.acc = 0; this.updateHud(); this.renderActive(false); }
    this.slowAcc += dt;
    if (this.slowAcc >= 0.5) { this.slowAcc = 0; this.updateBadges(); }
  }

  renderActive(force) {
    if (this.tab === 'biz') this.renderBiz(force);
    else if (this.tab === 'mgmt') this.renderMgmt(force);
    else if (this.tab === 'invest') this.renderInvest(force);
    else if (this.tab === 'lux') this.renderLux(force);
    else if (this.tab === 'empire') this.renderEmpire(force);
  }

  updateHud() {
    const g = this.g, s = g.s;
    setText($('#hudCash'), num(s.cash, true));
    const rate = g.incomeRate();
    setText($('#hudRate'), rate > 0 ? `+${money(rate)}/s` : 'Toque no 💰 para trabalhar');
    setText($('#hudStars'), num(s.stars));
    const hi = this.highestOwned();
    const era = this.eraIndex(hi);
    setText($('#hudEra'), ERAS[era].name);
    this.sky.setLevel(hi + 1, era);
    // boosts
    const now = Date.now();
    const bh = s.boosts.map(b => `<span class="boost ${b.m < 1 ? 'bad' : ''}">${esc(b.label)} ${mult(b.m)} · ${Math.ceil((b.until - now) / 1000)}s</span>`).join('');
    const box = $('#hudBoosts');
    if (box._h !== bh) { box.innerHTML = bh; box._h = bh; }
    setCls($('#fab'), 'hot', s.boosts.some(b => b.k === 't' || b.m >= 7));
    setCls($('#fab'), 'attn', s.lifetimeAll < 10);
    setText($('#fabV'), '+' + money(g.tapValue()));
    // próximo marco
    const k = s.marcoSeen;
    if (k < MARCOS.length) {
      const m = MARCOS[k];
      const prev = k > 0 ? MARCOS[k - 1].v : 0;
      const p = Math.max(0, Math.min(1, (Math.log10(Math.max(1, s.lifetimeAll)) - Math.log10(Math.max(1, prev))) / (Math.log10(m.v) - Math.log10(Math.max(1, prev)))));
      $('#goalFill').style.width = (p * 100).toFixed(1) + '%';
      setText($('#goalText'), `${m.emoji} ${m.name} · ${money(m.v)}`);
    }
  }

  updateBadges() {
    const g = this.g, s = g.s;
    const nb = (id, on) => setCls($(`#tabs [data-tab="${id}"]`), 'badge', on && this.tab !== id);
    let mg = false;
    for (let i = 0; i < B.length; i++) if (s.biz[i].n > 0 && !s.biz[i].m && g.mgrCost(i) <= s.cash) mg = true;
    const c = g.upgCandidates()[0];
    if (c && c.cost <= s.cash) mg = true;
    nb('mgmt', mg);
    const li = LUX.findIndex((x, i) => !s.lux.includes(i));
    nb('lux', li >= 0 && LUX[li].price <= s.cash);
    const perkOk = PERKS.some(p => g.perk(p.id) < p.max && p.cost(g.perk(p.id)) <= s.stars);
    nb('empire', g.starsPending() >= Math.max(10, s.stars * 0.5) || perkOk);
    nb('invest', false);
  }

  // ----- Negócios -----
  hintText() {
    const g = this.g, s = g.s, b0 = s.biz[0];
    if (s.prestiges > 0) return null;
    if (b0.n === 0 && s.cash < B[0].cost) return ['💰', 'Toque no botão dourado para vender água no farol. Junte R$ 10.'];
    if (b0.n === 0) return ['🧊', 'Compre seu primeiro isopor de água!'];
    if (!b0.m && s.st.runs < 4) return ['👆', 'Toque no negócio para produzir. Sem gerente, você precisa tocar a cada ciclo.'];
    if (!b0.m) return ['👔', `Junte ${money(g.mgrCost(0))} e contrate um gerente: aí o dinheiro entra sozinho.`];
    if (s.biz[1].n === 0) return ['🍿', 'Agora diversifique: abra um carrinho de pipoca.'];
    if (b0.n < 25 && s.lifetime < 5e4) return ['⚡', 'A cada marco de unidades (10, 25, 50...) o negócio ganha bônus. Segure o botão para comprar várias.'];
    if (s.lifetime < 3e5) return ['💼', 'Fique de olho nas maletas de dinheiro que aparecem na tela!'];
    return null;
  }

  renderBiz(force) {
    const g = this.g, s = g.s;
    const h = this.hintText();
    const hb = $('#hint');
    const hh = h ? `<div class="hint"><span class="e">${h[0]}</span><span>${h[1]}</span></div>` : '';
    if (hb._h !== hh) { hb.innerHTML = hh; hb._h = hh; }
    const n = g.unlockedCount();
    const items = [];
    for (let i = 0; i < n; i++) items.push({ key: i, html: () => this.bizHtml(i), update: el => this.updateBiz(el, i) });
    keyed($('#bizList'), items);
  }
  bizHtml(i) {
    const b = B[i];
    return `<div class="biz" data-i="${i}">
      <button class="biz-icon" data-act="run" data-i="${i}"><div class="in">${b.emoji}</div><span class="lvl">0</span></button>
      <div class="biz-body">
        <div class="biz-head"><b>${b.name}</b><span class="ms"></span></div>
        <div class="bar" data-act="run" data-i="${i}"><i></i><span class="rev"></span><span class="tm"></span></div>
        <div class="desc">${b.desc}</div>
        <div class="biz-foot"><button class="buy" data-i="${i}"><span class="q"></span><span class="c"></span></button><button class="mgr-chip" data-act="hire" data-i="${i}"></button></div>
      </div></div>`;
  }
  updateBiz(el, i) {
    const g = this.g, st = g.s.biz[i], c = g.c[i];
    if (!el._r) el._r = { lvl: $('.lvl', el), ms: $('.ms', el), icon: $('.biz-icon', el), bar: $('.bar', el), fill: $('.bar i', el), rev: $('.rev', el), tm: $('.tm', el), q: $('.q', el), c: $('.c', el), buy: $('.buy', el), mgr: $('.mgr-chip', el) };
    const r = el._r;
    const locked = st.n === 0;
    setCls(el, 'locked', locked);
    setText(r.lvl, num(st.n));
    const ms = c.ms;
    const prog = Math.max(0, Math.min(1, (st.n - ms.prev) / (ms.next - ms.prev)));
    const mv = Math.round(prog * 100);
    if (r.icon._ms !== mv) { r.icon.style.setProperty('--ms', mv); r.icon._ms = mv; }
    const ty = ms.nextType === 'speed' ? '⚡ veloc. x2' : ms.nextType === 'x3' ? '💰 x3' : '💰 x2';
    setText(r.ms, locked ? '' : `${ms.next}: ${ty}`);
    const q = g.buyQty(i);
    const cost = g.costOf(i, q);
    setText(r.q, locked ? 'Abrir' : 'x' + num(q));
    setText(r.c, money(cost));
    setCls(r.buy, 'no', cost > g.s.cash);
    if (!locked) {
      const T = g.cycleTime(i);
      const fast = st.m && T < 0.15;
      r.fast = fast;
      setCls(r.bar, 'fast', fast);
      setText(r.rev, fast ? money(g.cycleRev(i) / T) + '/s' : money(g.cycleRev(i)));
      const running = st.m || st.run;
      setText(r.tm, fast ? '' : time(running ? (1 - st.p) * T : T));
      setCls(el, 'idle', !st.m && !st.run);
      if (st.m) { setText(r.mgr, '👔 Auto'); setCls(r.mgr, 'hire', false); r.mgr.style.opacity = 1; }
      else {
        setText(r.mgr, '👔 ' + money(g.mgrCost(i)));
        const can = g.mgrCost(i) <= g.s.cash;
        setCls(r.mgr, 'hire', can);
        r.mgr.style.opacity = can ? 1 : 0.55;
      }
    }
  }
  updateBars() {
    if (this.tab !== 'biz') return;
    const list = $('#bizList').children;
    const g = this.g;
    for (const el of list) {
      if (!el._r) continue;
      const i = +el.dataset.i, st = g.s.biz[i];
      if (st.n === 0 || el._r.fast) continue;
      const p = (st.m || st.run) ? st.p : 0;
      el._r.fill.style.transform = `scaleX(${p.toFixed(4)})`;
    }
  }

  // ----- Gestão -----
  renderMgmt(force) {
    const g = this.g, s = g.s;
    document.querySelectorAll('#mgmtSeg button').forEach(b => b.classList.toggle('on', b.dataset.seg === this.mgmtSeg));
    $('#mgrWrap').style.display = this.mgmtSeg === 'mgr' ? '' : 'none';
    $('#upgWrap').style.display = this.mgmtSeg === 'upg' ? '' : 'none';
    if (this.mgmtSeg === 'mgr') {
      const items = [];
      for (let i = 0; i < g.unlockedCount(); i++) {
        const b = B[i], st = s.biz[i];
        items.push({ key: `${i}${st.m ? 'm' : ''}${st.n > 0 ? 'o' : ''}`,
          html: () => `<div class="item ${st.m ? 'done' : ''}"><div class="ico">${b.mgrEmoji}</div>
            <div class="grow"><div class="t">${b.mgr}</div><div class="d">${b.emoji} ${b.name}${st.n === 0 ? ' · abra o negócio primeiro' : ''}</div></div>
            ${st.m ? '<span class="green" style="font-weight:800">✓ Contratado</span>' : `<button class="btn sm" data-act="hire" data-i="${i}"></button>`}</div>`,
          update: el => {
            if (st.m) return;
            const btn = $('button', el); const cost = g.mgrCost(i);
            setText(btn, money(cost));
            const can = st.n > 0 && cost <= s.cash;
            setCls(btn, 'no', !can); setCls(el, 'can', can);
          } });
      }
      keyed($('#mgrList'), items);
    } else {
      const cands = g.upgCandidates().slice(0, 20);
      const items = cands.map(u => {
        const info = upgInfo(u.chain, u.k);
        return { key: `${u.chain}:${u.k}`,
          html: () => `<div class="item"><div class="ico">${info.emoji}</div>
            <div class="grow"><div class="t">${esc(info.name)}</div><div class="d">${info.desc}</div></div>
            <button class="btn sm" data-act="upg" data-c="${u.chain}"></button></div>`,
          update: el => {
            const btn = $('button', el);
            setText(btn, money(u.cost));
            const can = u.cost <= s.cash;
            setCls(btn, 'no', !can); setCls(el, 'can', can);
          } };
      });
      keyed($('#upgList'), items);
      const affordable = cands.filter(u => u.cost <= s.cash).length;
      setCls($('#buyAll'), 'no', affordable === 0);
    }
  }

  // ----- Investir -----
  renderInvest(force) {
    const g = this.g, s = g.s;
    this.invAcc = (this.invAcc || 0) + 1;
    if (!force && this.invAcc % 5) return; // 2x por segundo
    let val = 0, cost = 0;
    for (const id in s.pos) { val += g.posValue(id); cost += s.pos[id].cost; }
    setText($('#pfVal'), money(val));
    const pl = val - cost;
    const plEl = $('#pfPl');
    setText(plEl, (pl >= 0 ? '+' : '-') + money(Math.abs(pl)) + (cost > 0 ? ` (${pct(pl / cost)})` : ''));
    plEl.className = 'v ' + (pl >= 0 ? 'green' : 'red');
    const nh = g.news.slice(0, 4).map(n => `<div><span class="tag ${n.up ? 'up' : 'down'}">${n.up ? '▲' : '▼'}</span><span>${esc(n.text)}</span></div>`).join('') || '<div class="muted">Aguardando notícias do mercado...</div>';
    const nl = $('#newsList'); if (nl._h !== nh) { nl.innerHTML = nh; nl._h = nh; }
    const items = ASSETS.map(a => ({ key: a.id + (this.openAsset === a.id ? 'o' : ''),
      html: () => `<div class="asset ${this.openAsset === a.id ? 'open' : ''}" data-id="${a.id}">
        <div class="asset-row"><div class="ico">${a.emoji}</div>
          <div class="grow"><div class="tk">${a.tk}<span class="kind">${a.kind}</span></div><div class="nm ellipsis">${a.name}</div></div>
          <canvas width="168" height="68"></canvas>
          <div class="px"><b></b><span></span></div></div>
        <div class="trade">
          <div class="row small"><span class="grow muted pos-l">Sua posição</span><b class="pos-v"></b></div>
          <div class="row small" style="margin-top:3px"><span class="grow muted">Resultado</span><b class="pos-pl"></b></div>
          <div class="muted small" style="margin-top:8px">Comprar (% do caixa)</div>
          <div class="grid"><button class="btn green" data-act="buy" data-f="0.1">10%</button><button class="btn green" data-act="buy" data-f="0.25">25%</button><button class="btn green" data-act="buy" data-f="0.5">50%</button><button class="btn green" data-act="buy" data-f="1">Tudo</button></div>
          <div class="muted small" style="margin-top:8px">Vender (% da posição)</div>
          <div class="grid"><button class="btn red" data-act="sell" data-f="0.1">10%</button><button class="btn red" data-act="sell" data-f="0.25">25%</button><button class="btn red" data-act="sell" data-f="0.5">50%</button><button class="btn red" data-act="sell" data-f="1">Tudo</button></div>
        </div></div>`,
      update: el => this.updateAsset(el, a) }));
    keyed($('#assetList'), items);
  }
  updateAsset(el, a) {
    const g = this.g, m = g.s.mk[a.id];
    const first = m.h[0];
    const ch = m.p / first - 1;
    setText($('.px b', el), 'R$ ' + (m.p < 1 ? m.p.toFixed(4).replace('.', ',') : num(m.p, true)));
    const sp = $('.px span', el);
    setText(sp, pct(ch, 2));
    sp.className = ch >= 0 ? 'green' : 'red';
    const pos = g.s.pos[a.id];
    setCls(el, 'held', !!pos);
    if (this.openAsset === a.id) {
      const v = g.posValue(a.id);
      setText($('.pos-v', el), pos ? money(v) : '—');
      const pl = pos ? v - pos.cost : 0;
      const pe = $('.pos-pl', el);
      setText(pe, pos ? `${pl >= 0 ? '+' : '-'}${money(Math.abs(pl))} (${pct(pl / pos.cost)})` : '—');
      pe.className = 'pos-pl ' + (pl >= 0 ? 'green' : 'red');
    }
    // gráfico
    const cv = $('canvas', el);
    const key = m.h.length + ':' + m.p;
    if (cv._k === key) return;
    cv._k = key;
    const ctx = cv.getContext('2d');
    const pts = m.h.concat([m.p]);
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) { if (p < lo) lo = p; if (p > hi) hi = p; }
    if (hi - lo < hi * 0.002) { hi *= 1.001; lo *= 0.999; }
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const col = ch >= 0 ? '#3ee08f' : '#ff5d6c';
    ctx.beginPath();
    pts.forEach((p, k) => { const x = (k / Math.max(1, pts.length - 1)) * (W - 4) + 2, y = H - 4 - ((p - lo) / (hi - lo)) * (H - 8); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(W - 2, H); ctx.lineTo(2, H); ctx.closePath();
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, ch >= 0 ? 'rgba(62,224,143,0.35)' : 'rgba(255,93,108,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fill();
  }

  // ----- Luxo -----
  renderLux(force) {
    const g = this.g, s = g.s;
    setText($('#luxMult'), mult(+g.luxMult.toFixed(2)));
    setText($('#luxCount'), `${s.lux.length} de ${LUX.length} itens`);
    const show = [];
    let ahead = 0;
    for (const it of LUX) {
      if (s.lux.includes(it.i)) show.push(it);
      else if (ahead < 4) { show.push(it); ahead++; }
    }
    // os não comprados primeiro, depois a coleção
    const notOwned = show.filter(it => !s.lux.includes(it.i));
    const owned = show.filter(it => s.lux.includes(it.i)).reverse();
    const items = notOwned.concat(owned).map((it, k) => {
      const own = s.lux.includes(it.i);
      const mystery = !own && k >= 2;
      return { key: `${it.i}${own ? 'o' : ''}${mystery ? 'm' : ''}`,
        html: () => `<div class="lux ${own ? 'own' : ''} ${mystery ? 'mystery' : ''}"><div class="e">${it.emoji}</div>
          <div class="n">${mystery ? '???' : it.name}</div><div class="m">Lucro ${mult(it.mult)}</div>
          ${own ? `<div class="muted small">${money(it.price)}</div>` : `<button class="btn" data-act="lux" data-i="${it.i}">${money(it.price)}</button>`}</div>`,
        update: el => { if (!own) setCls($('button', el), 'no', it.price > s.cash); } };
    });
    keyed($('#luxGrid'), items);
  }

  // ----- Império -----
  renderEmpire(force) {
    const g = this.g, s = g.s;
    this.empAcc = (this.empAcc || 0) + 1;
    if (!force && this.empAcc % 3) return;
    // instalar
    const inst = $('#install');
    const ih = isStandalone() ? '' : isIOS
      ? `<div class="hint install"><span class="e">📲</span><span>Instale no iPhone: toque em <b>Compartilhar</b> <span style="font-size:17px">⎋</span> e depois em <b>Adicionar à Tela de Início</b>. Vira app de verdade, em tela cheia.</span></div>`
      : (this.deferredInstall ? `<div class="hint install"><span class="e">📲</span><span class="grow">Instale o Magnata como app.</span><button class="btn sm" id="btnInstall">Instalar</button></div>` : '');
    if (inst._h !== ih) { inst.innerHTML = ih; inst._h = ih; }
    setText($('#pStars'), num(s.stars));
    setText($('#pBonus'), `+${num(s.stars * g.starPct * 100)}% de lucro em tudo (${(g.starPct * 100).toFixed(1).replace('.', ',')}% por estrela)`);
    const gain = g.starsPending();
    $('#pGain').innerHTML = gain > 0 ? `Vender agora rende <b class="gold">+${num(gain)} ⭐</b>` : `<span class="muted">Ainda sem reputação para ganhar</span>`;
    setCls($('#btnPrestige'), 'no', gain <= 0);
    setText($('#pNext'), `Próxima ⭐ quando seus ganhos na vida chegarem a ${money(g.starsNextAt())}. Dica: venda quando dobrar suas estrelas.`);
    // talentos
    keyed($('#perkList'), PERKS.map(p => {
      const l = g.perk(p.id), max = l >= p.max;
      return { key: p.id + l,
        html: () => `<div class="item"><div class="ico">${p.emoji}</div><div class="grow"><div class="t">${p.name} <span class="muted small">nível ${l}/${p.max}</span></div><div class="d">${p.desc}</div></div>
          ${max ? '<b class="gold">MÁX</b>' : `<button class="btn violet sm" data-perk="${p.id}">${num(p.cost(l))} ⭐</button>`}</div>`,
        update: el => { if (!max) { const can = p.cost(l) <= s.stars; setCls($('button', el), 'no', !can); setCls(el, 'can', can); } } };
    }));
    // marcos
    const mk = s.marcoSeen;
    keyed($('#marcoList'), MARCOS.slice(0, Math.min(MARCOS.length, mk + 3)).map((m, k) => ({ key: m.i + (k < mk ? 'ok' : k === mk ? 'n' : ''),
      html: () => `<div class="marco ${k < mk ? 'ok' : ''} ${k === mk ? 'next' : ''}"><div class="dot">${k <= mk ? m.emoji : '🔒'}</div><div class="grow"><div style="font-weight:700">${k <= mk ? m.name : '???'}</div><div class="v">${money(m.v)} ganhos na vida</div></div>${k < mk ? '<span class="green">✓</span>' : ''}</div>` })));
    // conquistas
    setText($('#achCount'), `· ${g.achCount}/${ACH.length} · +${g.achCount * 2}% lucro`);
    keyed($('#achGrid'), [{ key: 'a' + g.achCount, html: () => `<div style="display:contents">${ACH.map((a, k) => `<button class="ach ${s.ach[a.id] ? 'ok' : ''}" data-ach="${k}">${s.ach[a.id] ? a.emoji : '🔒'}</button>`).join('')}</div>` }]);
    // estatísticas
    const st = s.st;
    const stats = [
      ['Ganhos na vida', money(s.lifetimeAll)], ['Nesta geração', money(s.lifetime)],
      ['Patrimônio agora', money(g.netWorth())], ['Maior renda', money(st.maxIncome) + '/s'],
      ['Gerações', num(s.prestiges + 1)], ['Tempo de jogo', time(st.play)],
      ['Toques', num(st.taps)], ['Maletas abertas', num(st.maletas)],
      ['IR pago', money(st.tax)], ['Melhor trade', st.bestTrade ? mult(+st.bestTrade.toFixed(2)) : '—'],
      ['Luxo', mult(+g.luxMult.toFixed(2))], ['Multiplicador total', mult(+g.globalMult().toPrecision(3))],
    ];
    const sh = stats.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    const sb = $('#stats'); if (sb._h !== sh) { sb.innerHTML = sh; sb._h = sh; }
    document.querySelectorAll('#settings .toggle').forEach(t => setCls(t, 'on', !!s.set[t.dataset.set]));
  }
}
