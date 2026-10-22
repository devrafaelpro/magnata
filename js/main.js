// Inicialização, laço principal, salvamento e PWA.
import { Game } from './engine.js';
import { UI } from './ui.js';
import { unlockAudio } from './fx.js';

const KEY = 'magnata-save-v1';

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const g = Game.load(raw); if (g) return g; }
  } catch (e) { /* sem storage */ }
  return new Game();
}

let game = loadGame();
let ui;

function save() {
  try { localStorage.setItem(KEY, game.toJSON()); } catch (e) { /* cheio ou bloqueado */ }
}

const hooks = {
  save,
  reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.reload();
  },
  importSave(code) {
    try {
      const json = decodeURIComponent(escape(atob(code)));
      const g = Game.load(json);
      if (!g) throw new Error('inválido');
      localStorage.setItem(KEY, json);
      location.reload();
    } catch (e) {
      ui.toast('⚠️', 'Código de save inválido');
    }
  },
};

ui = new UI(game, hooks);

// ganhos de quando o app estava fechado
const away = (Date.now() - (game.s.last || Date.now())) / 1000;
if (away > 30) {
  const r = game.offline(away);
  if (away > 60) ui.offlineReport(r);
}

// laço principal
let lastPerf = performance.now();
let lastWall = Date.now();
function frame(now) {
  const wall = Date.now();
  const gap = (wall - lastWall) / 1000;
  if (gap > 4) {
    // voltou do segundo plano
    const r = game.offline(gap);
    if (gap > 60) ui.offlineReport(r);
  } else {
    const dt = Math.min(0.5, Math.max(0, (now - lastPerf) / 1000));
    game.tick(dt);
    ui.frame(dt, now);
  }
  lastPerf = now; lastWall = wall;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

// destrava o áudio no primeiro toque (exigência do iOS)
const unlock = () => { unlockAudio(); };
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('touchend', unlock, { passive: true });

// evita zoom por gesto no iOS
document.addEventListener('gesturestart', e => e.preventDefault());

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.__game = game;
