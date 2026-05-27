import { test, expect } from "bun:test";
import {
  hudElementsToTargets, rectCenter, buildElicitChoices,
  buildGumTree, gumToHudNodes, type GumFlatNode,
} from "./hud.ts";

test("hudElementsToTargets dedupes TypeNames with a #n suffix", () => {
  const targets = hudElementsToTargets([
    { TypeName: "HudCrewStrip", LastDrawnBounds: { X: 0, Y: 0, Width: 100, Height: 20 } },
    { TypeName: "CrewCard", LastDrawnBounds: { X: 10, Y: 0, Width: 40, Height: 20 } },
    { TypeName: "CrewCard", LastDrawnBounds: { X: 50, Y: 0, Width: 40, Height: 20 } },
  ]);
  expect(targets.map((t) => t.label)).toEqual(["HudCrewStrip", "CrewCard", "CrewCard#1"]);
});

test("hudElementsToTargets drops elements with missing or zero-area bounds", () => {
  const targets = hudElementsToTargets([
    { TypeName: "NoBounds" },
    { TypeName: "ZeroArea", LastDrawnBounds: { X: 0, Y: 0, Width: 0, Height: 30 } },
    { TypeName: "Real", LastDrawnBounds: { X: 5, Y: 5, Width: 10, Height: 10 } },
  ]);
  expect(targets.map((t) => t.label)).toEqual(["Real"]);
});

test("hudElementsToTargets accepts lowercase bounds keys and tolerates non-arrays", () => {
  expect(hudElementsToTargets(null)).toEqual([]);
  const targets = hudElementsToTargets([{ TypeName: "L", bounds: { x: 1, y: 2, w: 3, h: 4 } }]);
  expect(targets[0]!.bounds).toEqual({ x: 1, y: 2, w: 3, h: 4 });
});

function gum(name: string, depth: number, w = 10, h = 10): GumFlatNode {
  return { name, depth, bounds: { x: 0, y: 0, w, h }, units: "px" };
}

test("buildGumTree nests flat depth-tagged nodes into a hierarchy", () => {
  const tree = buildGumTree([
    gum("Root", 0), gum("Panel", 1), gum("Card", 2), gum("Sibling", 1),
  ]);
  expect(tree.length).toBe(1);
  expect(tree[0]!.name).toBe("Root");
  expect(tree[0]!.children.map((c) => c.name)).toEqual(["Panel", "Sibling"]);
  expect(tree[0]!.children[0]!.children[0]!.name).toBe("Card");
});

test("gumToHudNodes keeps non-zero-area nodes and renormalises depth", () => {
  // Panel (kept) → invisible text node w=0 (dropped) → Pill (kept). The Pill's
  // depth collapses from gum-depth 2 to kept-depth 1.
  const nodes = gumToHudNodes([
    gum("Root", 0), gum("Panel", 1), gum("Invisible", 2, 0, 0), gum("Pill", 3),
  ]);
  expect(nodes.map((n) => [n.label, n.depth])).toEqual([
    ["Root", 0], ["Panel", 1], ["Pill", 2],
  ]);
});

test("gumToHudNodes suffixes repeated node names", () => {
  const nodes = gumToHudNodes([gum("Root", 0), gum("Bg", 1), gum("Bg", 1)]);
  expect(nodes.map((n) => n.label)).toEqual(["Root", "Bg", "Bg#1"]);
});

test("rectCenter rounds the centre point", () => {
  expect(rectCenter({ x: 0, y: 0, w: 100, h: 20 })).toEqual({ x: 50, y: 10 });
  expect(rectCenter({ x: 10, y: 10, w: 41, h: 21 })).toEqual({ x: 31, y: 21 });
});

test("buildElicitChoices indents enumNames by depth and appends the done sentinel", () => {
  const tree = [
    { label: "Panel", depth: 0, bounds: { x: 0, y: 0, w: 1, h: 1 } },
    { label: "Card", depth: 1, bounds: { x: 0, y: 0, w: 1, h: 1 } },
    { label: "Pill", depth: 2, bounds: { x: 0, y: 0, w: 1, h: 1 } },
  ];
  const choices = buildElicitChoices(tree, "✓ done");
  // enum holds plain labels — the selectable values — plus the sentinel.
  expect(choices.enum).toEqual(["Panel", "Card", "Pill", "✓ done"]);
  // enumNames indents each label by 2 spaces per depth; sentinel unindented.
  expect(choices.enumNames).toEqual(["Panel", "  Card", "    Pill", "✓ done"]);
});

test("buildElicitChoices on an empty tree yields just the sentinel", () => {
  const choices = buildElicitChoices([], "DONE");
  expect(choices.enum).toEqual(["DONE"]);
  expect(choices.enumNames).toEqual(["DONE"]);
});
