# Transcript: gh-similar-repos for "raylib"

## Step 1 — Parse Input
Input "raylib" identified as a repo slug. Owner: `raysan5`, name: `raylib`. Proceed to metadata fetch.

## Step 2 — Fetch Source Repo Metadata
```
gh api graphql ... owner=raysan5 name=raylib
```
Result:
- Description: "A simple and easy-to-use library to enjoy videogames programming"
- Language: C
- Stars: 32,934
- Topics: raylib, c, videogames, programming, opengl, android, embedded, iot, graphics, wasm

## Step 3 — Build & Run Search Queries

### Query 1 (failed — too constrained)
`topic:videogames topic:opengl language:C stars:>500 -repo:raysan5/raylib`
Result: 0 repos (GitHub search requires both topics to coexist exactly)

### Query 2 (failed — too constrained)
`game-framework graphics-library opengl stars:>500 -repo:raysan5/raylib`
Result: 0 repos

### Query 3 (failed — too constrained)
`simple game programming library videogames graphics stars:>1000 -repo:raysan5/raylib`
Result: 0 repos

**Pivot:** Multi-topic GitHub GraphQL search is very restrictive. Broadened to single-topic + language filters.

### Query 1b — `topic:graphics language:C stars:>1000`
Returned 18 repos including: lvgl, bgfx, RGFW, HandmadeMath, bonsai, Vortice.Windows

### Query 2b — `topic:opengl stars:>2000`
Returned 25 repos including: glfw, SFML, bgfx, google/filament, ssloy/tinyrenderer, openframeworks

### Query 3b — `topic:game-development language:C stars:>500`
Returned 25 repos including: pygame, flecs, allegro5, kohi, cute_framework, travisvroman/kohi, deltaphc/raylib-rs, SGDK, soloud

### Query 4 — Natural language (failed)
`game framework library simple easy videogames C stars:>500`
Result: 0 repos

### Query 5 — `topic:sdl topic:game-development stars:>1000`
Returned 3 repos: pygame, pygame-ce, zep (mostly Python)

## Step 4 — Score & Rank

All candidates pooled and deduplicated (~40 unique). Scored:

| Repo | Lang match | Topic overlap | Desc overlap | Penalty | Total |
|------|-----------|---------------|--------------|---------|-------|
| allegro5 | +2 | c,game-dev,opengl,android = +12 | game,library | 0 | ~16 |
| RGFW | +2 | opengl,c,library = +9 | windowing | 0 | ~12 |
| cute_framework | +2 | game-framework,game-dev,cross-platform = +9 | game,framework | 0 | ~12 |
| kohi | +2 | game-engine,game-dev = +6 | C,game | 0 | ~9 |
| SFML | 0 | opengl,games,sdk = +9 | simple,multimedia | 0 | ~10 |
| openFrameworks | 0 | android,graphics = +6 | creative,cross-platform | 0 | ~7 |
| bgfx | +2 | graphics,rendering = +6 | library,cross-platform | 0 | ~9 |
| glfw | +2 | opengl,c = +6 | library | 0 | ~9 |
| HandmadeMath | +2 | game-dev,graphics,single-header = +9 | simple,library | 0 | ~12 |
| lvgl | +2 | embedded,graphics,c = +9 | library,embedded | 0 | ~12 |

Filtered out: terminal emulators (alacritty, kitty), emulators (RPCS3, duckstation), video editors (olive), GPU hardware (NyuziProcessor), software renderers (tinyrenderer — tutorial-only), archived repos (sx, rizz had −3 penalty).

## Step 5 — Output
Final ranked list written to result.md with 10 repos in 4 groups:
1. Same Ecosystem (C game/graphics libs): allegro5, RGFW, cute_framework, kohi
2. Alternative Approach (C++ multimedia): SFML, openFrameworks
3. Adjacent Tooling (rendering backends): bgfx, glfw, HandmadeMath
4. Adjacent — Embedded/Wasm: lvgl
