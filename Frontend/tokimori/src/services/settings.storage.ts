export interface AccentPreset {
  label: string;
  accent: string;
  hover: string;
}

export interface AppSettings {
  accentColor: string;
  accentHover: string;
  reduceAnimations: boolean;
  timerNotifications: boolean;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { label: 'Violeta',  accent: '#667eea', hover: '#764ba2' },
  { label: 'Azul',     accent: '#3498db', hover: '#2980b9' },
  { label: 'Verde',    accent: '#27ae60', hover: '#1e8449' },
  { label: 'Naranja',  accent: '#f39c12', hover: '#d68910' },
  { label: 'Rojo',     accent: '#e74c3c', hover: '#c0392b' },
  { label: 'Rosa',     accent: '#e91e8c', hover: '#c2185b' },
];

const KEY = 'tokimori_settings';

export const DEFAULTS: AppSettings = {
  accentColor: '#667eea',
  accentHover: '#764ba2',
  reduceAnimations: false,
  timerNotifications: false,
};

export const settingsStorage = {
  get(): AppSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  },

  set(patch: Partial<AppSettings>): void {
    try {
      const current = settingsStorage.get();
      localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
    } catch {}
  },

  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};

export function applyAccentColor(accent: string, hover: string): void {
  document.documentElement.style.setProperty('--accent-color', accent);
  document.documentElement.style.setProperty('--accent-hover', hover);
}

export function applyReduceAnimations(enabled: boolean): void {
  document.documentElement.classList.toggle('reduce-animations', enabled);
}
