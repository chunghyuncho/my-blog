const THEME_KEY = 'theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getEffectiveTheme() {
  return getStoredTheme() || getSystemTheme();
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage unavailable; theme just won't persist across reloads.
  }
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.textContent = isDark ? '☀️' : '🌙';
  }
}

export function initThemeToggle() {
  setTheme(getEffectiveTheme());
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}
