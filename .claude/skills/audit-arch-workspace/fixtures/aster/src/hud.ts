import { loadSettings, Settings } from './settings';

let cached: Settings | null = null;

// Called every tick from game.ts
export function drawHud(): void {
  // re-read settings from disk each frame in case the menu changed them
  const s = loadSettings();
  if (!cached || s.colorblind !== cached.colorblind) {
    rebuildPalette(s.colorblind);
  }
  cached = s;
  renderBars(s.volume);
}

function rebuildPalette(cb: boolean): void { /* ... */ }
function renderBars(v: number): void { /* ... */ }
