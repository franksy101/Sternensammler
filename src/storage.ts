import { CONFIG } from "./config";

export interface PersistedState {
  muted: boolean;
  totalScatters: number;
  lastSceneIndex: number;
}

const defaults: PersistedState = {
  muted: false,
  totalScatters: 0,
  lastSceneIndex: 0,
};

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(CONFIG.storage.key);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(CONFIG.storage.key, JSON.stringify(state));
  } catch {
    // ignore — private mode, quota, etc.
  }
}
