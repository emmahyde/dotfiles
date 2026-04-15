# SVG.js 3.x Patterns

CDN: `https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3/dist/svg.min.js`

Init: `const draw = SVG('#container').size(W, H);`

## Shapes & Text

```js
// Rectangle with rounded corners
draw.rect(120, 40).radius(6).fill('#1a1a1a').stroke({ color: '#e63946', width: 1 });

// Circle
draw.circle(60).fill('#e63946').cx(200).cy(150);

// Text label centered in shape
draw.plain("Label").font({ family: 'monospace', size: 12, fill: '#f0f0f0' }).center(x, y);

// Multiline text
draw.text(add => { add.tspan("Line one").newLine(); add.tspan("Line two"); })
  .font({ family: 'monospace', size: 12 }).move(x, y);
```

## Paths & Connectors

```js
// Straight line
draw.line(x1, y1, x2, y2).stroke({ color: '#6b7280', width: 1.5, linecap: 'round' });

// Cubic bezier (smooth connector between nodes)
const cx = (x1 + x2) / 2;
draw.path(`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`)
  .fill('none').stroke({ color: '#6b7280', width: 1.5 });

// Arrowhead marker
const arrow = draw.marker(6, 6, add => {
  add.path('M 0 0 L 6 3 L 0 6 Z').fill('#6b7280');
}).ref(6, 3);
draw.line(x1, y1, x2, y2).stroke({ color: '#6b7280', width: 1.5 }).marker('end', arrow);
```

## Groups & Transforms

```js
// Labeled node group (reusable pattern)
function node(label, x, y) {
  const g = draw.group().translate(x, y);
  g.rect(120, 36).radius(6).fill('#1a1a1a').stroke({ color: '#e63946', width: 1 }).center(0, 0);
  g.plain(label).font({ family: 'monospace', size: 12, fill: '#f0f0f0' }).center(0, 0);
  return g;
}

// Nested group with clip
const clip = draw.clip().add(draw.rect(W, H));
draw.group().clipWith(clip).translate(offsetX, offsetY);
```

## Animation

```js
// Move with easing
draw.circle(60).fill('#e63946').move(0, 0)
  .animate(600, 0, 'now').ease('<>').move(300, 200);

// Sequence
shape.animate(400).attr({ fill: '#2a9d8f' })
     .animate(400).attr({ fill: '#e63946' });

// Loop
shape.animate(1200, '<>').loop().attr({ opacity: 0.3 })
     .animate(1200, '<>').attr({ opacity: 1 });

// Morph path
path.animate(800).plot('M 0 0 C 100 200 200 100 300 0');
```

## Interaction

```js
// Hover highlight
shape.on('mouseover', function() { this.stroke({ color: '#fff', width: 2 }); });
shape.on('mouseout',  function() { this.stroke({ color: '#e63946', width: 1 }); });

// Drag (SVG.js plugin: svg.draggable.js)
shape.draggable();

// Click with data bound to element
shape.data('id', nodeId);
shape.on('click', function() { console.log(this.data('id')); });
```

## Useful Utilities

```js
// Bounding box (for layout calculations)
const box = shape.bbox(); // { x, y, width, height, cx, cy }

// Foreign object (HTML inside SVG)
draw.foreignObject(200, 60).add(SVG('<div>HTML content</div>'));

// Clear and redraw
draw.clear(); // removes all children, keeps draw surface
```
