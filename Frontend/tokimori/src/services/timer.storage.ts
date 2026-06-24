export interface StoredTimer {
  endTime: number;
  pausedRemaining: number;
  duration: number;
  status: 'running' | 'paused' | 'done';
  idLibrary: number;
  itemName: string;
  itemImg?: string;
  idGame?: number;
  totalHours?: number;
}

const KEY = 'tokimori_timer';
const EVENT = 'tokimori_timer_change';

const pad = (n: number) => String(n).padStart(2, '0');

export const timerStorage = {
  get: (): StoredTimer | null => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredTimer) : null;
    } catch { return null; }
  },
  set: (t: StoredTimer) => {
    localStorage.setItem(KEY, JSON.stringify(t));
    window.dispatchEvent(new Event(EVENT));
  },
  clear: () => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  },
};

export const computeRemaining = (t: StoredTimer): number => {
  if (t.status === 'running') {
    return Math.max(0, Math.floor((t.endTime - Date.now()) / 1000));
  }
  return t.pausedRemaining;
};

export const computeProgress = (t: StoredTimer): number => {
  if (t.duration <= 0) return 0;
  const elapsed = t.duration - computeRemaining(t);
  return Math.min(100, Math.round((elapsed / t.duration) * 100));
};

export const formatRemaining = (t: StoredTimer): string => {
  const secs = computeRemaining(t);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
