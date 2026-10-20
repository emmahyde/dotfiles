# Meshes and Materials

Depth for P-POINTS and P-DOT. What a model is made of, and what makes it look like something.

## What a mesh is made of

Three lists, and nothing else.

- **Vertices.** Points in space. A vertex is a position, and often extra notes attached to that position.
- **Edges.** A line between two vertices. Mostly a modelling convenience.
- **Faces.** A flat patch filled between three or more vertices.

A cube is 8 vertices, 12 edges, 6 faces. The faces are what you see. The rest is bookkeeping.

## Triangles and quads

Hardware draws triangles only. Three points always lie on one flat plane, so a triangle can never be bent or ambiguous. Four points can.

Modellers still work in **quads**, four-sided faces, because quads deform predictably when a character bends and they subdivide into clean grids. The quads are cut into triangles at export. A quad becomes two triangles.

A face with five or more sides is an **n-gon**. It renders unpredictably and deforms badly. Keep n-gons off anything that bends.

Breaks when: an n-gon sits on a shoulder joint. The shoulder creases wrong and no amount of weight painting fixes it.

## Normals

Every face points somewhere, the way your palm points. That direction is the **normal**.

Normals do two jobs.

- **Lighting.** The normal is one half of P-DOT. Combine it with the light direction and you get brightness.
- **Which side is outside.** Renderers usually skip faces pointing away from the camera, to save work. This is **backface culling**.

### Flipped normals

If a face's normal points inward, two things happen at once. The face is culled when you look at it from outside, so you see straight through the model into its interior. And the lighting inverts, so the lit side goes dark.

The tell: parts of the model vanish depending on the angle you view them from, and the holes are shaped like faces.

### Vertex normals, and smooth versus flat

A normal can also be stored per vertex rather than per face. This is how one mesh reads as smooth or faceted without changing a single vertex position.

- **Flat shading.** Every vertex of a face uses the face's normal. You see the facets.
- **Smooth shading.** Each vertex averages the normals of the faces touching it, and the renderer blends between them across the face. A ten-sided cylinder looks round.

Smooth shading does not add geometry. The silhouette stays angular. This is why a low-poly smooth-shaded sphere looks round in the middle and polygonal at the edge.

## UV mapping

A texture is a flat image. A model is not flat. UV mapping is the instruction that says which part of the image lands on which part of the model.

The analogy: peel an orange and press the peel flat. The flat peel is your texture. The cuts you made are **seams**. Every vertex carries a coordinate in that flat image, written `(u, v)`, both running 0 to 1.

### Why it goes wrong

- **Stretching.** A region of model gets a small region of image, so the pixels smear. The flattened piece is smaller than it should be relative to the others.
- **Visible seams.** A cut lands where the eye goes. Put seams in hidden places: under arms, inside the collar, along a hard crease.
- **Overlap.** Two parts of the model claim the same image region. Fine when you want them identical, fatal when you want to bake lighting into the texture.

### Texel density

**Texel density** is texture pixels per unit of world surface. Keep it consistent across a model, or one part looks crisp and the next looks blurry, even though both use the same texture size.

The failure is easy to miss in isolation and obvious in a scene, because the eye compares neighbours.

## Textures, materials, shaders

These three words are often used loosely. They are different things.

- A **texture** is an image file. Just pixels.
- A **shader** is a small program that computes what colour each pixel ends up.
- A **material** is a shader plus the specific values you feed it: which textures, what colour tint, how shiny.

One shader, many materials. A "metal" shader serves gold, steel, and copper materials.

### The two shader stages

A shader runs in two stages, and knowing which is which explains most performance questions.

- **Vertex stage.** Runs once per vertex. This is where the transform chain happens. A model with 5000 vertices runs it 5000 times.
- **Fragment stage.** Runs once per pixel covered. A model filling a 1920x1080 screen runs it about two million times.

So work moved from the fragment stage to the vertex stage is roughly free, and work added to the fragment stage is expensive. Full-screen effects are all fragment work, which is why they cost what they cost.

## Common texture types

A modern material feeds several images into one shader.

- **Albedo** or **base colour.** The flat colour, with no lighting baked in.
- **Normal map.** Fake surface detail. It perturbs the normal per pixel, so the P-DOT calculation produces bumps that are not really there. The silhouette does not change, which is the tell.
- **Roughness.** How sharp reflections are. Low is mirror, high is chalk.
- **Metallic.** Whether the surface is metal. Usually 0 or 1, rarely between.
- **Ambient occlusion.** Where creases sit, so they can be darkened.

## Topology

**Topology** is how the faces are arranged, apart from what shape they make. Two models can look identical and have completely different topology.

It matters for two reasons only.

- **Deformation.** Faces must run along the direction a surface bends. Loops around a joint bend cleanly; a grid crossing the joint diagonally pinches.
- **Editability.** Clean loops can be selected, slid, and cut. A tangle cannot be edited without rebuilding.

Topology does not matter for a rock that never moves. Do not spend effort there.

For real decisions about edge flow, retopology, and poly budgets, use the `3d-modeling` skill. This section only defines the word.

## Level of detail

A model far from the camera covers few pixels, so its detail is wasted. **LOD** swaps in simpler versions as distance grows: LOD0 at 20000 triangles up close, LOD2 at 500 far away.

The related idea is **draw calls**. Each separate material or object costs one instruction to the graphics card. A thousand small objects is often slower than one large one with the same triangle count, because the cost is in the instructions, not the triangles.

## Sprites and billboards

- A **sprite** is a flat image drawn in a 2D game. No 3D geometry at all.
- A **billboard** is a flat image in a 3D world that turns to face the camera every frame. Distant trees, particles, and smoke are usually billboards.

The billboard tell: it looks solid until the camera moves in an arc, and then it swivels.

## A vocabulary check

If a reader can finish these sentences, the section landed.

- Hardware draws **triangles**; modellers work in **quads**.
- A normal is **the direction a surface faces**, and it drives **lighting** and **backface culling**.
- Smooth shading changes **normals**, not **geometry**, so the silhouette stays angular.
- UV mapping is **the peeled-flat pattern** that maps image to surface.
- A material is **a shader plus its values**.
- The fragment stage runs **once per pixel**, so it is where cost lives.
