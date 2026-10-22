// Som (Web Audio sintetizado), céu animado e partículas.

// ---------- Som ----------
let ctx = null, master = null, enabled = true;
export function setSound(v) { enabled = v; }
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  // toca um buffer vazio para destravar no iOS
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
}
function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slide = 0) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, when = 0, hp = 3000) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
let tapPitch = 0, lastTap = 0;
export const sfx = {
  tap() {
    const now = performance.now();
    tapPitch = now - lastTap < 250 ? Math.min(tapPitch + 1, 12) : 0;
    lastTap = now;
    tone(880 * Math.pow(2, tapPitch / 24), 0.07, 'triangle', 0.18);
    tone(1760 * Math.pow(2, tapPitch / 24), 0.04, 'sine', 0.06, 0.01);
  },
  buy() { tone(1318, 0.08, 'square', 0.08); tone(1975, 0.18, 'triangle', 0.14, 0.06); noise(0.08, 0.06, 0.02, 6000); },
  cash() { tone(2093, 0.06, 'triangle', 0.1); tone(2637, 0.12, 'triangle', 0.1, 0.05); },
  done() { tone(1568, 0.06, 'sine', 0.08); },
  milestone() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.07)); },
  ach() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.15, i * 0.09)); },
  maleta() { [1046, 1318, 1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, i * 0.045)); noise(0.3, 0.05, 0, 8000); },
  error() { tone(180, 0.15, 'sawtooth', 0.08, 0, 0.7); },
  event() { tone(440, 0.15, 'triangle', 0.15); tone(660, 0.25, 'triangle', 0.15, 0.12); },
  prestige() { [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, i * 0.1)); },
  trade() { tone(660, 0.05, 'square', 0.06); tone(990, 0.08, 'square', 0.06, 0.05); },
};

export function haptic(ms = 8) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sem vibração */ } }

// ---------- Céu animado (skyline) ----------
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export class Sky {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.level = 0; this.era = 0; this.stars = [];
    this.rockets = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
    const rnd = seeded(7);
    this.stars = Array.from({ length: 90 }, () => ({ x: rnd(), y: rnd() * 0.75, r: rnd() * 1.3 + 0.3, p: rnd() * 6 }));
    this.build();
  }
  setLevel(level, era) {
    if (level === this.level && era === this.era) return;
    this.level = level; this.era = era; this.build();
  }
  build() {
    // prédios conforme o progresso
    const rnd = seeded(42 + this.level);
    const L = this.level;
    const layers = [];
    for (let layer = 0; layer < 2; layer++) {
      const bs = [];
      let x = -10;
      const maxH = layer === 0 ? 0.35 + Math.min(L, 24) * 0.022 : 0.2 + Math.min(L, 24) * 0.016;
      while (x < this.w + 10) {
        const bw = 14 + rnd() * (layer === 0 ? 30 : 22) + (L > 8 ? rnd() * 10 : 0);
        const tall = rnd() < 0.15 + L * 0.015;
        const bh = this.h * (0.08 + rnd() * maxH * (tall ? 1.3 : 0.75));
        const wins = [];
        const cols = Math.max(1, Math.floor(bw / 7)), rows = Math.floor(bh / 9);
        for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < rows; ry++) if (rnd() < 0.45) wins.push([cx, ry, rnd() * 10]);
        bs.push({ x, w: bw, h: bh, wins, cols, antenna: tall && rnd() < 0.5 });
        x += bw + (layer === 0 ? 2 + rnd() * 4 : rnd() * 3);
      }
      layers.push(bs);
    }
    this.layers = layers;
  }
  draw(t) {
    const g = this.g, w = this.w, h = this.h, dpr = this.dpr;
    if (!w) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hour = new Date().getHours();
    const night = hour < 6 || hour >= 19;
    const space = this.era >= 5;
    const grd = g.createLinearGradient(0, 0, 0, h);
    if (space) { grd.addColorStop(0, '#05020f'); grd.addColorStop(0.6, '#140a2e'); grd.addColorStop(1, '#0a1d15'); }
    else if (night) { grd.addColorStop(0, '#040b1c'); grd.addColorStop(0.6, '#0b2238'); grd.addColorStop(1, '#0d2a20'); }
    else if (hour < 9 || hour >= 17) { grd.addColorStop(0, '#1b1440'); grd.addColorStop(0.55, '#7a3b4f'); grd.addColorStop(1, '#c9773b'); }
    else { grd.addColorStop(0, '#0b3a5c'); grd.addColorStop(0.6, '#1b6b7a'); grd.addColorStop(1, '#3b9a7a'); }
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // estrelas
    if (night || space) {
      for (const s of this.stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + s.p));
        g.fillStyle = `rgba(255,255,240,${a})`;
        g.beginPath(); g.arc(s.x * w, s.y * h, s.r, 0, 6.283); g.fill();
      }
    }
    // astro
    if (space) {
      const px = w * 0.8, py = h * 0.32, pr = 26;
      const pg = g.createRadialGradient(px - 8, py - 8, 4, px, py, pr);
      pg.addColorStop(0, '#ffb38a'); pg.addColorStop(1, '#a4342a');
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,220,180,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.45, -0.3, 0, 6.283); g.stroke();
    } else {
      const sx = w * 0.82, sy = h * 0.3;
      g.fillStyle = night ? 'rgba(255,250,225,0.9)' : 'rgba(255,240,190,0.95)';
      g.shadowColor = night ? 'rgba(255,255,230,0.7)' : 'rgba(255,220,120,0.9)'; g.shadowBlur = 24;
      g.beginPath(); g.arc(sx, sy, night ? 13 : 17, 0, 6.283); g.fill();
      g.shadowBlur = 0;
    }
    // foguetes ocasionais no espaço
    if (this.era >= 4) {
      if (Math.random() < 0.004 && this.rockets.length < 2) this.rockets.push({ x: w * (0.1 + Math.random() * 0.6), y: h, v: 0.6 + Math.random() * 0.5 });
      for (const r of this.rockets) {
        r.y -= r.v * 1.5;
        g.fillStyle = 'rgba(255,170,60,0.85)';
        g.beginPath(); g.ellipse(r.x, r.y + 9, 2, 7, 0, 0, 6.283); g.fill();
        g.fillStyle = '#e8eef5'; g.fillRect(r.x - 2, r.y - 6, 4, 12);
      }
      this.rockets = this.rockets.filter(r => r.y > -20);
    }
    // prédios
    const cols = [night || space ? '#0a1a26' : '#16314a', night || space ? '#061017' : '#0d2233'];
    this.layers.forEach((bs, li) => {
      const far = li === 1;
      for (const b of (far ? bs : bs)) {
        const y = h - b.h * (far ? 1.15 : 1);
        g.fillStyle = cols[far ? 0 : 1];
        if (far) g.globalAlpha = 0.85;
        g.fillRect(b.x, y, b.w, h - y);
        g.globalAlpha = 1;
        if (b.antenna) { g.fillRect(b.x + b.w / 2 - 1, y - 12, 2, 12); g.fillStyle = Math.sin(t / 300) > 0 ? '#ff4d4d' : '#5a1a1a'; g.fillRect(b.x + b.w / 2 - 1.5, y - 14, 3, 3); }
        if (!far) {
          for (const [cx, ry, ph] of b.wins) {
            const on = Math.sin(t / 2500 + ph) > -0.7;
            if (!on) continue;
            g.fillStyle = (night || space) ? 'rgba(255,214,120,0.85)' : 'rgba(190,230,255,0.35)';
            g.fillRect(b.x + 3 + cx * 7, y + 5 + ry * 9, 3, 4);
          }
        }
      }
    });
  }
}

// ---------- Partículas ----------
export class FX {
  constructor(layer) { this.layer = layer; this.count = 0; }
  float(x, y, text, cls = '') {
    if (this.count > 30) return;
    const d = document.createElement('div');
    d.className = 'float ' + cls;
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    this.layer.appendChild(d); this.count++;
    setTimeout(() => { d.remove(); this.count--; }, 900);
  }
  coins(x, y, tx, ty, n = 3, emoji = '🪙') {
    for (let i = 0; i < n; i++) {
      if (this.count > 40) return;
      const d = document.createElement('div');
      d.className = 'coin'; d.textContent = emoji;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      this.layer.appendChild(d); this.count++;
      const dx = (Math.random() - 0.5) * 120, dy = -40 - Math.random() * 70;
      const anim = d.animate([
        { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(0.5)`, opacity: 0.2 },
      ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.4,0,.6,1)', delay: i * 30 });
      anim.onfinish = () => { d.remove(); this.count--; };
    }
  }
  burst(x, y, emojis = ['💵', '💰', '🪙', '💎'], n = 16) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'coin'; d.textContent = emojis[i % emojis.length];
      d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.fontSize = (18 + Math.random() * 14) + 'px';
      this.layer.appendChild(d);
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 120;
      const anim = d.animate([
        { transform: 'translate(-50%,-50%) scale(0.3) rotate(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r + 60}px)) scale(1) rotate(${(Math.random() - 0.5) * 400}deg)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.1,.8,.3,1)' });
      anim.onfinish = () => d.remove();
    }
  }
  flash() {
    const d = document.createElement('div'); d.className = 'flash';
    this.layer.appendChild(d); setTimeout(() => d.remove(), 700);
  }
}
