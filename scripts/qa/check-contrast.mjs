// WCAG contrast check for the muted-text token in every theme, against both
// the page background and the card background it actually renders on.
// Usage: node scripts/qa/check-contrast.mjs
const lum = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Values read from src/index.css (midnight default) and src/lib/themes.js.
const THEMES = {
  midnight: { bg: '#0f172a', card: '#1e293b', muted: '#8692a4', secondary: '#94a3b8' },
  arctic:   { bg: '#f0f4f8', card: '#ffffff', muted: '#626c7a', secondary: '#475569' },
  lavender: { bg: '#1a1625', card: '#2d2640', muted: '#9891ae', secondary: '#b8b0d0' },
  sunset:   { bg: '#1c1210', card: '#2c1e1a', muted: '#a08678', secondary: '#d4a88c' },
};

const AA = 4.5;
let fail = 0;
for (const [name, t] of Object.entries(THEMES)) {
  for (const surface of ['bg', 'card']) {
    for (const token of ['muted', 'secondary']) {
      const r = ratio(t[token], t[surface]);
      const ok = r >= AA;
      if (!ok) fail++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(9)} ${token.padEnd(9)} on ${surface.padEnd(4)} ${r.toFixed(2)}:1`);
    }
  }
}
console.log(fail === 0 ? '\nAll text tokens meet WCAG AA (4.5:1).' : `\n${fail} token/surface pairs below 4.5:1.`);
process.exit(fail === 0 ? 0 : 1);
