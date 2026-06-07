## Repos like MonoGame for C# game dev

**Input:** "What are things like MonoGame for C# game dev?"
**Signals used:** C# language, topics: game-engine, game-framework, gamedev, csharp, cross-platform, xna

---

### Same Ecosystem (XNA lineage / drop-in alternatives)

1. **FNA-XNA/FNA** ⭐ 2,983
   C# · xna · fna · csharp · gamedev · cross-platform
   > FNA - Accuracy-focused XNA4 reimplementation for open platforms
   **Why:** Direct XNA4 API re-implementation targeting open platforms (Linux, macOS, consoles). Same content pipeline assumptions as MonoGame, different runtime approach — SDL2/FNA3D vs OpenGL. Lower overhead, widely used for porting commercial XNA games.
   https://github.com/FNA-XNA/FNA

2. **MonoGame-Extended/Monogame-Extended** ⭐ 1,726
   C# · monogame
   > Extensions to make MonoGame more awesome
   **Why:** Not an alternative but a direct superset — adds tilemap, camera, tweens, collision, and UI components missing from base MonoGame. Relevant if the goal is staying in MonoGame but filling gaps.
   https://github.com/MonoGame-Extended/Monogame-Extended

---

### Alternative C# Game Engines / Frameworks

3. **FosterFramework/Foster** ⭐ 826
   C# · game-engine · game-development · 2d · cross-platform · csharp · dotnet
   > A small C# game framework
   **Why:** Highest topic overlap with MonoGame's positioning (cross-platform, game-engine, csharp, dotnet, 2d). Actively maintained, written by the same author as the Celeste engine. No content pipeline baggage — SDL3 + GLSL. Closest spiritual successor in surface area.
   https://github.com/FosterFramework/Foster

4. **stride3d/stride** ⭐ 7,601
   C# · game-engine · game-development · gamedev · csharp · direct3d · vulkan
   > Stride (formerly Xenko), a free and open-source cross-platform C# game engine.
   **Why:** Full 3D engine with editor, Vulkan/D3D12/Metal backends, entity-component system, and C# scripting. Higher complexity than MonoGame (editor required for full workflow) but best-in-class if you need a Unity-like C# engine without Unity licensing.
   https://github.com/stride3d/stride

5. **ppy/osu-framework** ⭐ 1,951
   C# · game-frameworks · game-engine · osu · hacktoberfest
   > A game framework written with osu! in mind.
   **Why:** Real-world battle-tested C# game framework powering osu! (rhythm game, >100M users). Strong custom draw tree, input abstraction, audio system. Not general-purpose but highly instructive; topics match game-engine + game-frameworks. Active.
   https://github.com/ppy/osu-framework

6. **AdamsLair/duality** ⭐ 1,427 ⚠️ archived
   C# · game-engine · game-development · gamedev · framework
   > a 2D Game Development Framework
   **Why:** High topic overlap (game-engine, framework, gamedev, game-development) and historically well-regarded 2D C# framework with a visual editor. Archived — no new development. Listed for completeness; do not adopt for new projects.
   https://github.com/AdamsLair/duality

---

### Lower-Level C# Graphics Bindings (build your own framework)

7. **dotnet/Silk.NET** ⭐ 5,040
   C# · opengl · csharp · vulkan · openal · opencl · native
   > The high-speed OpenGL, OpenCL, OpenAL, OpenXR, GLFW, SDL, Vulkan, Assimp, WebGPU, and DirectX bindings library your mother warned you about.
   **Why:** The canonical low-level .NET bindings for GPU APIs. If you want to build a framework (not use one), Silk.NET is the foundation layer. Several indie C# engines use it under the hood. Matches csharp + opengl topics.
   https://github.com/dotnet/Silk.NET

8. **veldrid/veldrid** ⭐ 2,676
   C# · graphics · opengl · direct3d · vulkan · game-development · metal
   > A low-level, portable graphics library for .NET.
   **Why:** Abstraction over D3D11, Vulkan, Metal, OpenGL, OpenGL ES — single API surface. Good for writing a portable renderer without locking to one backend. Matches game-development topic + C# language.
   https://github.com/veldrid/veldrid

9. **raylib-cs/raylib-cs** ⭐ 1,316
   C# · raylib · csharp · gamedev
   > C# bindings for raylib, a simple and easy-to-use library to learn videogames programming
   **Why:** Thin C# wrapper over raylib (C). Extremely lightweight, no content pipeline, immediate-mode style. Good for prototyping or small games; not a full framework replacement for MonoGame's asset pipeline approach.
   https://github.com/raylib-cs/raylib-cs

---

**Why these?** Recommendations were driven by three signals: C# primary language, topic overlap with MonoGame's own tags (xna, game-engine, game-framework, gamedev, csharp, cross-platform), and description keyword overlap with "game framework". Foster scored highest on topic density among active alternatives; Stride leads on stars and 3D capability; FNA leads for direct XNA-compatibility drop-ins.
