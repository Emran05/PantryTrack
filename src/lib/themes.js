// Theme definitions — each theme is a set of CSS variable overrides
// Only color tokens are overridden; spacing, radius, typography stay global.

const themes = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    preview: ['#0f172a', '#1e293b', '#22c55e'],
    vars: {}, // default — uses :root values from index.css
  },

  arctic: {
    id: 'arctic',
    label: 'Arctic',
    preview: ['#f8fafc', '#ffffff', '#0ea5e9'],
    vars: {
      '--color-bg-primary': '#f0f4f8',
      '--color-bg-secondary': '#e2e8f0',
      '--color-bg-card': '#ffffff',
      '--color-bg-card-hover': '#f1f5f9',
      '--color-bg-input': '#f8fafc',
      '--color-bg-modal': 'rgba(0, 0, 0, 0.35)',
      '--color-border': '#cbd5e1',
      '--color-border-light': '#94a3b8',
      '--color-surface-glass': 'rgba(255, 255, 255, 0.85)',
      '--color-accent': '#0ea5e9',
      '--color-accent-hover': '#0284c7',
      '--color-accent-soft': 'rgba(14, 165, 233, 0.12)',
      '--color-accent-glow': 'rgba(14, 165, 233, 0.25)',
      '--color-text-primary': '#0f172a',
      '--color-text-secondary': '#475569',
      '--color-text-muted': '#94a3b8',
      '--color-text-inverse': '#ffffff',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.06)',
      '--shadow-lg': '0 8px 30px rgba(0, 0, 0, 0.1)',
    },
  },

  lavender: {
    id: 'lavender',
    label: 'Lavender',
    preview: ['#1a1625', '#2d2640', '#a855f7'],
    vars: {
      '--color-bg-primary': '#1a1625',
      '--color-bg-secondary': '#2d2640',
      '--color-bg-card': '#2d2640',
      '--color-bg-card-hover': '#3b3354',
      '--color-bg-input': '#1a1625',
      '--color-bg-modal': 'rgba(0, 0, 0, 0.6)',
      '--color-border': '#443c5c',
      '--color-border-light': '#5c5278',
      '--color-surface-glass': 'rgba(45, 38, 64, 0.85)',
      '--color-accent': '#a855f7',
      '--color-accent-hover': '#9333ea',
      '--color-accent-soft': 'rgba(168, 85, 247, 0.12)',
      '--color-accent-glow': 'rgba(168, 85, 247, 0.25)',
      '--color-text-primary': '#f3f0ff',
      '--color-text-secondary': '#b8b0d0',
      '--color-text-muted': '#7c7298',
      '--color-text-inverse': '#1a1625',
    },
  },

  sunset: {
    id: 'sunset',
    label: 'Sunset',
    preview: ['#1c1210', '#2c1e1a', '#f97316'],
    vars: {
      '--color-bg-primary': '#1c1210',
      '--color-bg-secondary': '#2c1e1a',
      '--color-bg-card': '#2c1e1a',
      '--color-bg-card-hover': '#3d2a24',
      '--color-bg-input': '#1c1210',
      '--color-bg-modal': 'rgba(0, 0, 0, 0.6)',
      '--color-border': '#4d352c',
      '--color-border-light': '#6b4a3e',
      '--color-surface-glass': 'rgba(44, 30, 26, 0.85)',
      '--color-accent': '#f97316',
      '--color-accent-hover': '#ea580c',
      '--color-accent-soft': 'rgba(249, 115, 22, 0.12)',
      '--color-accent-glow': 'rgba(249, 115, 22, 0.25)',
      '--color-text-primary': '#fef3e2',
      '--color-text-secondary': '#d4a88c',
      '--color-text-muted': '#8b6b5a',
      '--color-text-inverse': '#1c1210',
    },
  },
};

const THEME_KEY = 'pantry_theme';
const DEFAULT_THEME = 'midnight';

export function getThemeList() {
  return Object.values(themes);
}

export function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

export function saveTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);
}

export function applyTheme(themeId) {
  const theme = themes[themeId];
  if (!theme) return;

  const root = document.documentElement;

  // First, remove any previously applied theme vars
  // (reset to defaults by removing inline styles)
  Object.values(themes).forEach((t) => {
    Object.keys(t.vars).forEach((varName) => {
      root.style.removeProperty(varName);
    });
  });

  // Apply the new theme's vars
  Object.entries(theme.vars).forEach(([varName, value]) => {
    root.style.setProperty(varName, value);
  });

  // Update meta theme-color for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bgColor = theme.vars['--color-bg-primary'] || '#0f172a';
    meta.setAttribute('content', bgColor);
  }

  saveTheme(themeId);
}

export default themes;
