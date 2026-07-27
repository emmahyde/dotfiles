import { loadSettings, saveSettings } from './settings';

export function applyMenuChange(key: string, value: unknown): void {
  const s = loadSettings();
  (s as any)[key] = value;
  saveSettings(s);
  // hud and audio will pick this up on their next per-tick poll
}
