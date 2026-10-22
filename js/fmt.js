// Formatação de números e tempo em pt-BR

const NAMES = ['', 'mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci',
  'undeci', 'duodeci', 'tredeci', 'quatordeci', 'quindeci', 'sexdeci', 'septendeci', 'octodeci', 'novendeci', 'vigint'];

let scientific = false;
export function setScientific(v) { scientific = !!v; }

function letters(k) {
  // aa, ab, ... az, ba ...
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return a[Math.floor(k / 26) % 26] + a[k % 26];
}

function dec(x, d) {
  return x.toFixed(d).replace('.', ',');
}

export function num(x, small = false) {
  if (x !== x) return '0';
  if (!isFinite(x)) return '∞';
  const neg = x < 0;
  x = Math.abs(x);
  let s;
  if (x < 1000) {
    if (small && x < 100 && x % 1 !== 0) s = dec(x, x < 10 ? 2 : 1);
    else s = String(Math.floor(x));
  } else if (scientific && x >= 1e6) {
    s = x.toExponential(2).replace('.', ',').replace('e+', 'e');
  } else {
    let e = Math.floor(Math.log10(x) / 3);
    let m = x / Math.pow(10, e * 3);
    if (m >= 999.995) { e++; m /= 1000; }
    if (e === 1 && x < 1e6) {
      // 1.234 até 999.999 com separador de milhar
      s = Math.floor(x).toLocaleString('pt-BR');
    } else {
      const suf = e < NAMES.length ? NAMES[e] : letters(e - NAMES.length);
      s = dec(m, m < 10 ? 2 : m < 100 ? 1 : 0) + ' ' + suf;
    }
  }
  return (neg ? '-' : '') + s;
}

export function money(x) {
  return 'R$ ' + num(x, true);
}

export function pct(x, d = 1) {
  return (x >= 0 ? '+' : '') + dec(x * 100, d) + '%';
}

export function time(s) {
  s = Math.max(0, s);
  if (s < 1) return dec(s, 1) + 's';
  if (s < 60) return Math.floor(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + String(Math.floor(s % 60)).padStart(2, '0') + 's';
  if (s < 86400) return Math.floor(s / 3600) + 'h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + 'm';
  if (s < 86400 * 365) return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
  return num(s / (86400 * 365)) + ' anos';
}

export function mult(x) {
  if (x < 1000) return 'x' + (x % 1 === 0 ? x : dec(x, x < 10 ? 2 : 1));
  return 'x' + num(x);
}
