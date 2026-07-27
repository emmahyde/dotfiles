import * as fs from 'fs';

export interface Settings { volume: number; difficulty: string; colorblind: boolean; }

export function loadSettings(): Settings {
  return JSON.parse(fs.readFileSync('settings.json', 'utf8'));
}

export function saveSettings(s: Settings): void {
  fs.writeFileSync('settings.json', JSON.stringify(s));
}
