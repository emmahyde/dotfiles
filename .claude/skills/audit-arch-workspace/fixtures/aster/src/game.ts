import { drawHud } from './hud';
import { updateAudio } from './audio';
import { Inventory } from './inventory';

const inv = new Inventory();

export function tick(): void {
  simulate();
  drawHud();
  updateAudio();
}

function simulate(): void { /* dungeon simulation core */ }
