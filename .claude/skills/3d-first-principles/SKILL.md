---
name: 3d-first-principles
description: |
  Explain 3D modeling, game world space, screen space, and cameras from first
  principles, in plain short sentences, for a reader who does not know the jargon.
  Builds each idea before it names it. Use when the user asks what something is or
  why it behaves the way it does: "what is a normal", "what is a matrix", "explain
  UV mapping", "eli5 3d", "what is world space", "local vs world space", "why does
  it get bigger when I move toward it", "orthographic vs perspective", "what is FOV",
  "what is a frustum", "near clip", "far clip", "why is my object invisible", "what
  is z-fighting", "what is a draw call", "isometric", "2.5D", "parallax", "billboard",
  "sprite", "pixels per unit", "why does my camera look wrong", "explain projection",
  "screen space", "camera stacking", "culling mask", "quaternion", "gimbal lock",
  "what is a shader", "vertex vs fragment", "why is my model black", "flipped normals",
  "triangles vs quads", "topology", "texel density", "eli5", "first principles",
  "explain like I am five", "teach me 3d", "I do not know this area of graphics".
---

# 3D From First Principles

## What this skill is for

Explain graphics and game-space ideas to someone who has never used them. Build each idea from nothing. Name it only after they can already picture it.

This is a teaching skill, not a production skill. For topology decisions, UV layout, retopology, and export pipelines, use the `3d-modeling` skill instead. For headless Blender asset work, use `blender`.

## How to explain (the contract)

Follow these six rules. They are the skill.

- **E-BUILD.** Build the idea, then name it. Never open with the jargon word. Wrong: "A normal is a unit vector perpendicular to the surface." Right: "Every flat face points somewhere, like your palm. That direction is the *normal*."
- **E-ONEPICTURE.** One physical analogy per idea. Never mix two analogies for one idea. A reader who holds two pictures holds neither.
- **E-BREAKS.** Say what goes wrong when you get it wrong. An idea with no failure mode is trivia. "Normals point the wrong way, so the model turns inside out and you see through it."
- **E-NUMBERS.** Give the number, not the adjective. Not "the patch is quite large". Instead: "the patch is 50 degrees wide and the camera sees 100 degrees, so it fills half the screen."
- **E-JOB.** For a "why is it like this" question, answer in three steps. State the thing's job. Show the mechanism that job forces. Show why the obvious alternative fails at that job.
- **E-DRAW.** Draw it when the shape is the point. A frustum, a coordinate frame, and a camera stack are all shapes. Words alone make the reader rebuild the picture in their head.

Register: short active sentences, one idea each, present tense. See the `simple-english` skill for the full rule set.

## The six principles

Everything below is built from these. Teach them in order. A reader who holds all six can derive most of the rest without help.

### P-POINTS — a 3D model is a list of points

A model is a list of positions in space, plus a note about which points join into triangles. That is all it is. There is no "solid" anywhere. A sphere is a few hundred points arranged in a ball shape, with triangles stretched between them.

Breaks when: you expect a model to have an inside. It does not. It is a shell, like a paper lantern.

### P-RECIPE — a matrix is one instruction card

To move, turn, or resize a model, you do arithmetic on every one of its points. A *matrix* is a card that holds all three instructions at once: move this far, turn this much, scale by this. You apply the card to a point and get a new point.

Cards stack. "Turn, then move" is a different result from "move, then turn", the same way it is for a person walking. Order matters, always.

Breaks when: you apply the cards in the wrong order and the object orbits a distant point instead of spinning in place.

### P-ORIGIN — a "space" is just what you measure from

The same point has different numbers depending on where you count from. Your hand is 30 cm from your shoulder, and 4000 km from Paris. Both are correct. They are different *spaces*.

Games use a few:

- **Local space** — measured from the model's own centre. A wheel is at "front left of the car", whatever the car is doing.
- **World space** — measured from one shared origin everyone agrees on.
- **View space** — measured from the camera.
- **Screen space** — measured in pixels, from a corner of the screen.

Breaks when: you compare two numbers from different spaces. This is the single most common bug in the whole subject. The numbers look fine and the result is nonsense.

### P-FLATTEN — a camera does not exist

There is no camera object in the world. Rendering means turning 3D points into 2D screen positions. A "camera" is two things only: a place you measure from, and a rule for flattening.

Breaks when: you look for a camera to fix a framing problem. The fix is usually in the flattening rule, not the position.

### P-DIVIDE — there are exactly two flattening rules

This is the one that explains most confusion about size and distance.

- **Perspective**: divide the point's position by its depth. Something twice as far away lands half as far from the screen centre, so it looks half as big. This is your eye. This is a pinhole camera.
- **Orthographic**: do not divide. Depth is thrown away entirely. Something twice as far away looks exactly the same size.

Orthographic is a shadow cast by the sun. The sun is so far away that its rays arrive parallel. Hold a coin at your knee, then at your head. Its shadow is the same size both times.

Perspective is your eye. Rays fan out from one point, so distant things cover less of the fan.

Breaks when: you want a flat map feel and you use a perspective camera. Objects grow as you approach them, and no amount of tuning removes that, because the growth *is* the division.

### P-DOT — light is one multiplication

A surface is lit by how much it faces the light. Take the direction the face points and the direction the light comes from, and combine them into one number between -1 and 1. Facing the light gives 1. Edge-on gives 0. Facing away gives a negative number, which means shadow.

That single number drives almost all shading. Cel shading takes it and rounds it into two or three steps instead of a smooth ramp.

Breaks when: the face points the wrong way. Then the lit side is dark and the model reads inside out.

## Where to go next

- [Spaces and cameras](references/spaces-and-cameras.md) — the transform chain, perspective vs orthographic in detail, FOV, clip planes, frustums, why things vanish, isometric and 2.5D, parallax, screen space and pixels-per-unit.
- [Meshes and materials](references/meshes-and-materials.md) — vertices, edges, faces, triangles vs quads, normals, smooth vs flat shading, UV mapping, textures, materials, shaders, and what "topology" means.

## Diagnosing a confused reader

Match the complaint to the principle. Teach that principle, not the symptom.

| The reader says | Teach |
| --- | --- |
| "It gets bigger as I move toward it and I don't want that" | P-DIVIDE |
| "It's in the wrong place and the numbers look right" | P-ORIGIN |
| "It spins around something far away instead of itself" | P-RECIPE |
| "It's inside out" / "I can see through it" / "the lit side is dark" | P-DOT |
| "It disappeared and I didn't move it" | P-FLATTEN, then clip planes |
| "The texture is smeared or stretched" | UV mapping |
| "Two surfaces flicker against each other" | depth precision |
