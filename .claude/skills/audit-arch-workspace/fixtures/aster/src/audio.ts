import { loadSettings } from './settings';

// Called every tick from game.ts
export function updateAudio(): void {
  // poll settings each frame so volume changes apply
  const s = loadSettings();
  setMasterVolume(s.volume);
}

function setMasterVolume(v: number): void { /* ... */ }
