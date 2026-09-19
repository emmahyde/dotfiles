# Worked example: a render pipeline as a plain-text guide

The source is `docs/PZ-ISO-RENDER-GUIDE.md` in sector-unity-proto — a Project Zomboid
render-pipeline guide whose explanations live or die on spatial layout: where things sit on a
grid, what occludes what, and in what order they paint. Everything below is Tier B, capped at
100 columns. Every diagram is copied byte-exact from the source, with its legend strip.

What it demonstrates beyond the other two worked examples:

- **spatial pictures** — a sprite anchored inside its own texture, drawn from `/`, `\`, and box
  glyphs, with the projection math in the right-hand gutter
- **nested spans** — `├ ┤` bars showing one depth axis at four scales, one shape per scale
- **panes as lanes** — the paint order of one frame read left to right across `┃` columns
- **a bar chart** — quantised block bars with the scale fixed inside the block
- **a wide gate row** — eleven answers off one `<>` condition, with the legend declared inside
  the block
- **a two-lane language timeline** — Java and Lua in one picture, with hops across the boundary
- **a fan-out** — one stem, five invalidations, every arrowhead on one column

## Where a sprite anchors

`IsoObject` anchors every sprite by one pixel: `offsetX` 64, `offsetY` 192 at tileScale 2. The
picture shows which pixel that is, and what the projection does with it.

*legend* — `┌ ┐` the sprite texture, `/ \` the floor diamond, `+` the anchor pixel; symbols verbatim from `IsoUtils` and `IsoObject`.

```
   sprite texture, 128 x 256 px at tileScale 2       the floor diamond, seen from above
   ┌───────────────────────────┐ row 0                           (x, y)
   │                           │                                   /\
   │    wall or object art     │  rows 0..191                    /    \
   │    anything tall lives    │  hang above the tile          /        \
   │    up here                │                   (x, y+1) /   128 x 64  \ (x+1, y)
   │                           │                            \     px      /
   │             +             │ row 192 = offsetY            \        /
   │           /   \           │  this pixel lands on           \    /
   │         /       \         │  XToScreen, YToScreen            \/
   │         \       /         │  rows 192..255: the diamond   (x+1, y+1)
   │           \   /           │
   └─────────────v─────────────┘ row 256
   col 0        64 = offsetX  128           screen x = (x - y) * 32 * ts     +X runs down-right
                                            screen y = (x + y) * 16 * ts     +Y runs down-left
```

Why it works: rule 4 does the lifting — the box is the texture, the diamond is the floor, and
`+` is one exact pixel. The gutter carries the projection math in the code's own symbols, while
the `row 0` / `rows 0..191` labels carry narration in the other register. A weaker version draws
a rectangle labelled "sprite" with an arrow saying "anchors here", and leaves the reader to ask
which of 32,768 pixels it means.

## How deep one square is

PZ never sorts sprites. Every square carries one depth scalar, and the axis below nests four
times, from the visible window down to one sprite.

*legend* — `├ ┤` a span of the depth axis, nested from the whole window down to one sprite; numbers are the constants in `IsoDepthHelper`.

```
 the depth axis, far on the left, near on the right; written as d * 2 - 1 into the buffer

 visible window
 ├──────────────────── 20 chunks x CHUNK_DEPTH 0.023093667 = 0.46187335 ──────────────────┤

 one chunk
 ├─── 16 half-square steps: ((8 - x % 8) + (8 - y % 8)) / 16 * CHUNK_DEPTH ───┤

 one square, one level
 ├── LEVEL_DEPTH 0.0028867084 = CHUNK_DEPTH / 8, times (2 - (z - minLevel)) ──┤
 levels are paired: calculateMinLevel = level / 2 * 2, LEVELS_PER_TEXTURE = 2

 inside one sprite
 ├─ soffY / 96 * LEVEL_DEPTH, plus the per-pixel depth map ─┤
```

Why it works: one shape, `├ ┤`, means one thing at four scales, so the nesting is the argument —
a sprite's span sits inside a square's, inside a chunk's, inside the window's. The gutter labels
carry the scale, the numbers inside the bars carry the constants verbatim from `IsoDepthHelper`.
A weaker version draws four separate mini-diagrams, and the reader can no longer see what
encloses what.

## What paints one frame

One frame is a fixed set of passes. The picture is the order, and each lane's footer names the
method that draws that pane.

*legend* — `┃` one pane of the frame, back to front left to right, `>` the eye; pane names are the Java methods that draw them.

```
 one frame as panes, back to front; the eye is on the right

 FBORenderCell        weather      SkyBox     DoBuilding   world text    screen UI
 ┃                    ┃            ┃          ┃            ┃             ┃
 ┃ chunk FBOs         ┃ rain       ┃ 512x512  ┃ ghosts     ┃ markers     ┃ windows
 ┃ models             ┃ fog        ┃ FBO      ┃ 0.6 white  ┃ world text  ┃ tooltips
 ┃ shadows            ┃ snow       ┃ <= 1/s   ┃ 0.6 red    ┃ followers   ┃ menus
 ┃ highlight          ┃ clouds     ┃          ┃            ┃             ┃ moodles
 ┃ outline last       ┃            ┃          ┃            ┃             ┃
 ┸────────────────────┸────────────┸──────────┸────────────┸─────────────┸──────────> eye
 renderFrameInternal                                       renderFrameText  renderFrameUI
```

Why it works: rule 8 turned sideways — each `┃` lane owns one pane, and position left to right
is paint order back to front. The `┸` comb row and the `> eye` arrow give the picture its
direction without a single verb. A weaker version boxes the pane names and arrows them in a
chain, which asserts a data flow that does not exist: weather does not feed SkyBox, every pane
just draws over the frame.

## How bright the night is

The night darkness option sets the ambient floor. Four options, four bar lengths.

*legend* — bar length is the ambient floor, 20 columns per 1.0.

```
 ambient floor by the night darkness option, 20 columns = 1.0; plus 0.075 * moon * night
 1 darkest   ▏         0
 2           █▍        0.07
 3           ███       0.15
 4 brightest █████     0.25
```

Why it works: length carries the value, and the header row inside the block fixes the scale —
20 columns per 1.0 — so the chart needs no caption. Labels stay in the left gutter, numbers in
the right column, and the quantised block glyphs keep every bar on the column grid. A weaker
version scales each bar to fit its row width, which erases exactly the difference the chart
exists to show.

## What a wall does between you and the camera

What fades between the camera and the player is one decision with eleven answers, and
`targetAlpha` is the answer in every branch.

```
kind    ┌ step ┐   ┏ actor ┓   ╔ external ╗   ├ store ┤   ( event )   ╭┈ note ┈╮
reads   symbol_name()  verbatim from source     *  narration, mine, not the code

<> what sits between the camera and the player?
   |
   +-- cut door or window, seen before ----------------> targetAlpha 0.4
   |
   +-- cut door or window, never seen -----------------> targetAlpha 0
   |
   +-- open door --------------------------------------> targetAlpha 0.6
   |
   +-- roof overhang ----------------------------------> targetAlpha 0.05
   |
   +-- fascia -----------------------------------------> targetAlpha 0
   |
   +-- cut square, canSee -----------------------------> targetAlpha 0.25
                                                         * 0 when the player cannot see it
   |
   +-- tabletop or generic obscurer -------------------> targetAlpha 0.66
   |
   +-- attachedCeiling --------------------------------> targetAlpha 0.25
   |
   +-- stairs -----------------------------------------> targetAlpha 0.5
   |
   +-- window at distance d ---------------------------> lerp(0.1, 0.75, 1 - d * d / 25)
   |
   +-- square above player z in a collapsed building --> never submitted
                                                         * shouldRenderBuildingSquare()
```

Why it works: this is a rule-5 gate — one condition on the `<>` row, every arrowhead on one
column, eleven answers down the branches. The legend lives inside the block as two plain rows
and declares both channels before the first branch. The `* ` rows carry the exceptions. A weaker
version writes the same thing as an if/else list in prose, and the two special cases — the
window lerp and the never-submitted square — sink to the bottom where no one reads them.

## Who answers a right-click

A right-click crosses from Java to Lua and back twice before the menu shows. The two lanes are
the two runtimes.

*legend* — two lanes, Java left and Lua right, time runs down; `( )` an event, `>` a hop across the language boundary.

```
 Java                                     │ Lua
 ─────────────────────────────────────────┼─────────────────────────────────────────────────
 UIManager.setPicked()                    │
  * once per frame, mouse not on any UI   │
  * CPU rect tests, no GPU id buffer      │
            └────────────────────────────>│ ( OnObjectRightMouseButtonDown )
                                          │ ISObjectClickHandler.doRClick()
                                          │  * lua/server, not lua/client
                                          │ ISContextManager.createWorldMenu()
                                          │ ISWorldObjectContextMenu.createMenu()
                                          │  * none while paused, asleep, on the map, trading
 ISWorldObjectContextMenuLogic.fetch()    │<────────────┘
  * entries built in priority families    │
            └────────────────────────────>│ ( OnFillWorldObjectContextMenu )   mods add here
                                          │ ISContextMenu slides in from up-left
                                          │  * header-only menus are hidden
                                          │ onHighlight: setHighlighted(true)
                                          │              + setOutlineHighlight(true)
                                          │  * ISInventoryPage.OnObjectHighlighted mirrors it
```

Why it works: rule 8 — the lane owns the code. Java keeps the left lane, Lua the right, time
runs down, and every `>` hop marks one crossing of the language boundary, so the round trips are
visible at a glance. The `( )` event shapes mark where mods hook in. A weaker version merges the
lanes into one column of calls, and the reader can no longer tell who answers a call, or where a
mod is allowed to inject.

## Where a state change lives in the tilesheet

A sprite is one row of a tilesheet, and a state is an index into that row. Most states are fixed
hops. One is not.

*legend* — `┌ ┼ ┐` cells of one tilesheet row, index left to right; a filled cell is a state.

```
 one tilesheet row; a state change is a fixed hop along the index

 index      n      n+1     n+2     n+3     n+4     ...     n+8
          ┌───────┬───────┬───────┬───────┬───────┬───────┬───────┐
 door     │closed │       │ open  │       │       │       │       │  IsoDoor: +2, double +4
          ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤          garage +8
 curtain  │closed │       │       │       │ open  │       │       │  IsoCurtain: +4
          ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
 window   │intact │ smashed: index + SmashedTileOffset (tile prop)│  IsoWindow
          └───────┴───────┴───────┴───────┴───────┴───────┴───────┘

 by name instead of by hop:
   lamp_01_4  <->  lamp_01_4_on_     IsoWorld pairs every "_on_" twin at load
   Stove_...  <->  Stove_ON_...      "_ON_" inserted mid-name
   IsoThumpable keeps explicit closedSprite and openSprite fields
   IsoLightSwitch never swaps: it draws the _on_ overlay at (1, 1, 1)
```

Why it works: the strip is a table whose rows are sprite families and whose columns are indices,
so "a state change is a fixed hop" is a picture, not a claim. The offsets sit in the
right-hand commentary column. The window row runs its cells together because smashing is a
different mechanism — a tile property, not a hop — and the grid says so instead of faking one.
A weaker version lists the offsets in prose, and the two mechanisms blur into one.

## What one door toggle touches

Toggling a door swaps one sprite and dirties five caches. The fan-out is the contract: miss a
branch and one system goes stale.

*legend* — `├ └` fan-out from one Java method; `( )` an event; symbols verbatim from `IsoDoor`.

```
 IsoDoor.ToggleDoorActual(): one swap, five caches to dirty

     this.sprite = open or closed sprite         what the eye sees
     │
     ├──> square.RecalcAllWithNeighbours(true)   lighting, LOS, room flags
     │
     ├──> sync(int)                              PacketType.SyncIsoObject to the other side:
     │                                           x, y, z, getObjectIndex(), open, locked
     ├──> PolygonalMap2.instance.squareChanged() pathfinding
     │
     ├──> ( OnContainerUpdate )                  Lua listeners, inventory windows
     │
     └──> invalidateRenderChunkLevel(256L)       the chunk FBO; skip it and the door stays
                                                 shut on screen until something else dirties it
```

Why it works: one stem, five branches, and every arrowhead lands on one column, so "one swap,
five caches to dirty" is the shape of the picture. The right-hand column carries what each
branch buys, and the last branch carries the failure mode — skip it and the door stays shut on
screen. A weaker version writes five bullets, which loses both the shared cause and the one
branch that must not be skipped.

## Notes

- The source cites a Java, Lua, or shader line for every claim, and the diagrams keep their
  symbols verbatim from that source — `XToScreen`, `ToggleDoorActual()`, `glDepthFunc(515)` —
  so a reader can grep the drawing. This is the register rule at full strength: narration lives
  in `* ` rows and plain sentences, code names stay untouched.
- Every legend strip sits directly above its diagram and names only the shapes that diagram
  uses, so each strip teaches the grammar it needs and nothing else.
- The spatial pictures — the anchor inset, the floor diamond, the panes, the tilesheet strip —
  are drawn from Tier B box glyphs and plain `/ \ . +` ASCII, so they survive any terminal and
  the linter can check every column.
- The numbers in the diagrams are the real constants — `CHUNK_DEPTH 0.023093667`, the 0.25
  ambient ceiling, the +2/+4/+8 index hops — which makes each picture double as a reference
  table.
- The source excludes its legacy render path in one prose sentence rather than drawing two
  pipelines. One doc, one pipeline, stated up front: worth copying.
