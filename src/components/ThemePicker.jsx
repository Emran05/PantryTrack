import { getThemeList, getSavedTheme, applyTheme } from '../lib/themes';
import './ThemePicker.css';

export default function ThemePicker() {
  const themes = getThemeList();
  const current = getSavedTheme();

  const handleSelect = (themeId) => {
    applyTheme(themeId);
    // Force re-render by updating the DOM attribute for active state
    document.querySelectorAll('.theme-swatch').forEach((el) => {
      el.classList.toggle('active', el.dataset.theme === themeId);
    });
  };

  return (
    <div className="theme-picker">
      {themes.map((theme) => (
        <button
          key={theme.id}
          data-theme={theme.id}
          className={`theme-swatch ${current === theme.id ? 'active' : ''}`}
          onClick={() => handleSelect(theme.id)}
          aria-label={`${theme.label} theme`}
        >
          <div className="theme-swatch-colors">
            <span className="theme-swatch-bg" style={{ background: theme.preview[0] }} />
            <span className="theme-swatch-card" style={{ background: theme.preview[1] }} />
            <span className="theme-swatch-accent" style={{ background: theme.preview[2] }} />
          </div>
          <span className="theme-swatch-label">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}
