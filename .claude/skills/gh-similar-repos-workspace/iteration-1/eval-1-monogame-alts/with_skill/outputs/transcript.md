# Execution Transcript: MonoGame Alternatives Search

## Input Classification
Input: "What are things like MonoGame for C# game dev?"
Type: Stack description → skip repo metadata fetch, proceed directly to query construction.

## Step 1: Build Search Queries

Derived signals from MonoGame's known profile:
- Language: C#
- Topics: game-engine, game-framework, gamedev, csharp, cross-platform, xna
- Description keywords: framework, cross-platform, games

## Step 2: Run Searches

### Query 1 — topic:game-engine language:CSharp stars:>100
Result: 0 repos (GitHub topic filter returned empty — likely due to topic indexing sparsity)

### Query 2 — topic:game-framework language:CSharp stars:>100
Result: 0 repos (same issue)

### Query 3 — game engine framework csharp language:CSharp stars:>500
Result: 1 repo (scellecs/morpeh — Unity ECS, not relevant)

### Query 4 — 2d game framework dotnet stars:>200 language:CSharp
Results: AdamsLair/duality (archived), FosterFramework/Foster

### Query 5 — Direct repo metadata fetches for known candidates
Fetched: stride3d/stride, FosterFramework/Foster, AdamsLair/duality, nkast/MonoGame (fork, irrelevant),
MonoGame-Extended/Monogame-Extended, bottlenoselabs/sokol-cs (archived), ppy/osu-framework,
raylib-cs/raylib-cs, dotnet/Silk.NET, veldrid/veldrid, FNA-XNA/FNA

### Query 6 — game framework opengl csharp dotnet stars:>200
Result: AdamsLair/duality (duplicate)

### Query 7 — MonoGame/MonoGame (reference)
Fetched to confirm topics: xna, monogame, game-framework, gamedev, csharp, cross-platform

## Step 3: Deduplication

Candidates after dedup (9 unique active/semi-active repos):
- stride3d/stride
- FNA-XNA/FNA
- FosterFramework/Foster
- dotnet/Silk.NET
- veldrid/veldrid
- ppy/osu-framework
- raylib-cs/raylib-cs
- AdamsLair/duality (archived)
- MonoGame-Extended/Monogame-Extended (adjacent, not alternative)

## Step 4: Scoring

Scoring rubric: +3 per matching topic, +2 language match, +1 per description keyword overlap,
-3 archived, -1 no activity >2 years.

Reference signals (from MonoGame): xna, monogame, game-framework, gamedev, csharp, cross-platform

| Repo | Score | Notes |
|---|---|---|
| FosterFramework/Foster | +22 | 6 topic matches, C#, active |
| stride3d/stride | +17 | 4 topic matches, C#, active, highest stars |
| FNA-XNA/FNA | +13 | 3 topic matches (xna direct hit), C#, active |
| AdamsLair/duality | +13 | 4 topic matches but -3 archived |
| ppy/osu-framework | +10 | 2 topic matches, C#, active |
| dotnet/Silk.NET | +10 | 2 topic matches, C#, very active |
| veldrid/veldrid | +10 | 2 topic matches, C#, active |
| raylib-cs/raylib-cs | +9 | 2 topic matches, C#, active |
| MonoGame-Extended | +6 | 1 topic match (monogame), C# — adjacent |

## Step 5: Group by Theme

Three natural groups emerged:
1. XNA lineage / drop-in alternates: FNA, MonoGame-Extended
2. Alternative C# game engines: Foster, Stride, osu-framework, Duality
3. Low-level bindings (DIY framework foundation): Silk.NET, Veldrid, raylib-cs

## Notes

- GitHub topic-based search returned 0 results on first 2 queries — topic sparsity issue.
  Fell back to keyword searches + direct repo metadata fetches for known candidates.
- This matches the skill's fallback guidance: REST endpoint or direct repo fetches.
- sokol-cs skipped: archived + <100 stars, graphics-API binding not game-framework.
- c2cs skipped: codegen tool, not a game framework.
