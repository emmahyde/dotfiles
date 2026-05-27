// mtime-based cache keying for the sector_ast outline. Lets the tool skip
// re-shelling Sector.Cli when the source has not changed.

import { statSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Build a cache key for a C# file or directory. The key changes whenever any
 * contained `.cs` file is edited (mtime bump), added, or removed (count
 * change) — so a hit guarantees the outline is still current. `bin`/`obj` are
 * skipped, matching the Sector.Cli walk.
 */
export function astCacheKey(absPath: string): string {
  const st = statSync(absPath);
  if (st.isFile()) return `${absPath}:${st.mtimeMs}`;

  let count = 0;
  let maxMtime = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "bin" || entry.name === "obj") continue;
        walk(join(dir, entry.name));
      } else if (entry.name.endsWith(".cs")) {
        count++;
        const m = statSync(join(dir, entry.name)).mtimeMs;
        if (m > maxMtime) maxMtime = m;
      }
    }
  };
  walk(absPath);
  return `${absPath}:dir:${count}:${maxMtime}`;
}
