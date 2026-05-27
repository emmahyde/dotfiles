import { test, expect } from "bun:test";
import { join } from "path";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, utimesSync } from "fs";
import { tmpdir } from "os";
import { astCacheKey } from "./astcache.ts";

test("astCacheKey for a file changes when the file's mtime changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "astcache-"));
  const f = join(dir, "A.cs");
  writeFileSync(f, "class A {}");
  const k1 = astCacheKey(f);
  // Bump mtime explicitly — two writes in the same ms would collide otherwise.
  const future = new Date(Date.now() + 5000);
  utimesSync(f, future, future);
  expect(astCacheKey(f)).not.toBe(k1);
});

test("astCacheKey for a directory changes on file add and remove", () => {
  const dir = mkdtempSync(join(tmpdir(), "astcache-"));
  writeFileSync(join(dir, "A.cs"), "class A {}");
  const k1 = astCacheKey(dir);

  writeFileSync(join(dir, "B.cs"), "class B {}"); // add → count change
  const k2 = astCacheKey(dir);
  expect(k2).not.toBe(k1);

  rmSync(join(dir, "B.cs"));                      // remove → count change
  expect(astCacheKey(dir)).not.toBe(k2);
});

test("astCacheKey ignores bin/obj directories", () => {
  const dir = mkdtempSync(join(tmpdir(), "astcache-"));
  writeFileSync(join(dir, "A.cs"), "class A {}");
  const k1 = astCacheKey(dir);

  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "Generated.cs"), "class G {}");
  expect(astCacheKey(dir)).toBe(k1);
});
