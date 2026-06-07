# MonoGame Alternatives for C# Game Development

Frameworks and engines in the C# ecosystem, ordered by relevance to MonoGame use cases.

---

## Drop-in / Close Alternatives

### [Foster](https://github.com/FosterFramework/Foster)
- **Stars:** 826 | **Updated:** May 2026
- Small, modern C# game framework by the creator of Celeste's engine
- Closer to MonoGame in scope (2D-first, lightweight), .NET 8+
- Best fit if you want MonoGame ergonomics with cleaner internals

### [Murder](https://github.com/isadorasophia/murder)
- **Stars:** 3,259 | **Updated:** May 2026
- Pixel art ECS game engine built on MonoGame + ImGui.NET
- Uses Flecs-style ECS, has a built-in editor
- Good fit: same stack (MonoGame underneath), but adds ECS + tooling layer

### [Wobble](https://github.com/Quaver/Wobble)
- **Stars:** ~200 | **Updated:** May 2026
- MonoGame extension framework from the Quaver rhythm game
- Adds scene management, UI, input abstractions on top of MonoGame
- Additive rather than replacement

---

## Full Engines (More Opinionated)

### [Stride](https://github.com/stride3d/stride)
- **Stars:** 7,601 | **Updated:** May 2026
- Formerly Xenko; full-featured cross-platform 3D engine in C#
- Has editor, PBR rendering, scripting system
- Much heavier than MonoGame; overkill for 2D-focused games

### [osu!framework](https://github.com/ppy/osu-framework)
- **Stars:** 1,951 | **Updated:** May 2026
- Game framework extracted from osu!, production-hardened
- Strong layout/UI system, custom rendering pipeline
- Quirky API shaped by osu!'s needs; not general-purpose friendly

---

## Low-Level / Roll-Your-Own Base

### [OpenTK](https://github.com/opentk/opentk)
- **Stars:** 3,513 | **Updated:** May 2026
- C# bindings for OpenGL, OpenAL, OpenCL + windowing + math
- MonoGame itself uses OpenTK under the hood (DesktopGL)
- Use if you want full control and will build your own abstractions

---

## Notes

- **MonoGame.Extended** (1,726 stars) is additive to MonoGame, not a replacement — covers collision, tweening, cameras, tilemaps.
- **Unity** is obviously the gorilla in the room but is a separate runtime (not .NET native game loop).
- **Godot with GDExtension/C# bindings** is an alternative runtime but diverges significantly from MonoGame's code-first model.
- For Sector's use case (2D headless-simulatable engine + MonoGame frontend), **Murder** is the most architecturally similar production reference, and **Foster** is the cleanest "what if MonoGame but modern" comparison point.
