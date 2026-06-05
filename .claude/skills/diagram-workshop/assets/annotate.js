/**
 * Diagram Workshop — Annotation Overlay
 * Drop <script src="annotate.js"></script> anywhere in your diagram HTML.
 *
 * Tools: Browse · Pen · Rect · Circle · Arrow · Text · Erase
 * Export: 📷 captures SVG diagram + annotations as a PNG you can show Claude.
 */
(function () {
  // ── State ──────────────────────────────────────────────────────────────────
  let tool = 'browse';
  let color = '#ff3333';
  let strokeW = 2;
  let drawing = false;
  let startX = 0, startY = 0;
  let snapshot = null;       // ImageData before current stroke (for shape preview)
  const history = [];        // undo stack

  // ── Canvas overlay ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', top: 0, left: 0,
    width: '100vw', height: '100vh',
    pointerEvents: 'none', zIndex: 9998,
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    const img = new Image();
    const data = canvas.toDataURL();
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (data !== 'data:,') { img.onload = () => ctx.drawImage(img, 0, 0); img.src = data; }
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const TOOLS = [
    { id: 'browse', icon: '↔',  label: 'Browse (Esc)' },
    { id: 'pen',    icon: '✏',  label: 'Freehand pen' },
    { id: 'rect',   icon: '▭',  label: 'Rectangle' },
    { id: 'circle', icon: '○',  label: 'Circle' },
    { id: 'arrow',  icon: '→',  label: 'Arrow' },
    { id: 'text',   icon: 'T',  label: 'Text note' },
    { id: 'erase',  icon: '⌫',  label: 'Erase' },
  ];

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', bottom: '14px', left: '14px',
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'rgba(12,12,12,0.92)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '9px', padding: '5px 8px',
    fontFamily: 'monospace', fontSize: '13px',
    zIndex: 9999, userSelect: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    cursor: 'grab',
  });

  // Make toolbar draggable
  let dragging = false, dx = 0, dy = 0;
  bar.addEventListener('mousedown', e => {
    if (e.target !== bar && e.target.tagName !== 'SPAN') return;
    dragging = true;
    dx = e.clientX - bar.getBoundingClientRect().left;
    dy = e.clientY - bar.getBoundingClientRect().top;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    bar.style.left = (e.clientX - dx) + 'px';
    bar.style.bottom = 'auto';
    bar.style.top  = (e.clientY - dy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  const toolBtns = {};

  function mkBtn(icon, label, onClick) {
    const b = document.createElement('button');
    b.title = label; b.textContent = icon;
    Object.assign(b.style, {
      background: 'transparent', border: '1px solid transparent',
      borderRadius: '5px', color: '#bbb', cursor: 'pointer',
      padding: '3px 7px', fontSize: '14px', lineHeight: '1.2',
      transition: 'all .12s',
    });
    b.onmouseenter = () => { if (!b._active) b.style.background = 'rgba(255,255,255,.08)'; };
    b.onmouseleave = () => { if (!b._active) b.style.background = 'transparent'; };
    b.onclick = onClick;
    bar.appendChild(b);
    return b;
  }

  function sep() {
    const s = document.createElement('span');
    s.textContent = '|';
    Object.assign(s.style, { color: 'rgba(255,255,255,.18)', padding: '0 2px', cursor: 'default' });
    bar.appendChild(s);
  }

  TOOLS.forEach(t => { toolBtns[t.id] = mkBtn(t.icon, t.label, () => setTool(t.id)); });
  sep();

  // Color + stroke width
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color'; colorPicker.value = color;
  Object.assign(colorPicker.style, { width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: '3px' });
  colorPicker.oninput = e => { color = e.target.value; };
  bar.appendChild(colorPicker);

  const widthSlider = document.createElement('input');
  widthSlider.type = 'range'; widthSlider.min = 1; widthSlider.max = 14; widthSlider.value = 2;
  Object.assign(widthSlider.style, { width: '56px', cursor: 'pointer', accentColor: '#e63946' });
  widthSlider.oninput = e => { strokeW = +e.target.value; };
  bar.appendChild(widthSlider);
  sep();

  mkBtn('↩', 'Undo (⌘Z)', undo);
  mkBtn('🗑', 'Clear annotations', clearAll);
  mkBtn('📷', 'Export PNG (diagram + annotations)', capture);

  document.body.appendChild(bar);

  // ── Tool activation ────────────────────────────────────────────────────────
  function setTool(t) {
    tool = t;
    canvas.style.pointerEvents = t === 'browse' ? 'none' : 'all';
    canvas.style.cursor = { browse: 'default', pen: 'crosshair', rect: 'crosshair',
      circle: 'crosshair', arrow: 'crosshair', text: 'text', erase: 'cell' }[t] || 'crosshair';
    Object.values(toolBtns).forEach(b => {
      b._active = false;
      b.style.background = 'transparent';
      b.style.borderColor = 'transparent';
      b.style.color = '#bbb';
    });
    if (toolBtns[t]) {
      toolBtns[t]._active = true;
      toolBtns[t].style.background = 'rgba(230,57,70,.22)';
      toolBtns[t].style.borderColor = '#e63946';
      toolBtns[t].style.color = '#fff';
    }
  }
  setTool('browse');

  // ── Drawing ────────────────────────────────────────────────────────────────
  function saveHistory() { history.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (history.length > 40) history.shift(); }
  function undo() { if (history.length) ctx.putImageData(history.pop(), 0, 0); }
  function clearAll() { saveHistory(); ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function styleCtx() {
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = strokeW; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }

  canvas.addEventListener('mousedown', e => {
    if (tool === 'browse') return;
    drawing = true; startX = e.clientX; startY = e.clientY;
    saveHistory();
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (tool === 'pen') { styleCtx(); ctx.beginPath(); ctx.moveTo(startX, startY); }
    if (tool === 'text') {
      const txt = prompt('Annotation text:');
      if (txt) { styleCtx(); ctx.font = `bold ${Math.max(14, strokeW * 5)}px monospace`; ctx.fillText(txt, startX, startY); }
      drawing = false;
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const x = e.clientX, y = e.clientY;
    if (tool === 'pen') { styleCtx(); ctx.lineTo(x, y); ctx.stroke(); }
    if (tool === 'erase') { ctx.clearRect(x - strokeW * 5, y - strokeW * 5, strokeW * 10, strokeW * 10); }
    if (['rect', 'circle', 'arrow'].includes(tool)) {
      if (snapshot) ctx.putImageData(snapshot, 0, 0);
      styleCtx();
      if (tool === 'rect') { ctx.strokeRect(startX, startY, x - startX, y - startY); }
      if (tool === 'circle') {
        const rx = (x - startX) / 2, ry = (y - startY) / 2;
        ctx.beginPath(); ctx.ellipse(startX + rx, startY + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (tool === 'arrow') { drawArrow(startX, startY, x, y); }
    }
  });

  canvas.addEventListener('mouseup', () => { drawing = false; snapshot = null; });
  canvas.addEventListener('mouseleave', () => { drawing = false; });

  function drawArrow(x1, y1, x2, y2) {
    const h = Math.max(12, strokeW * 4), a = Math.atan2(y2 - y1, x2 - x1);
    styleCtx();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
    ctx.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  }

  // Touch support
  function toMouse(e) { return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }; }
  canvas.addEventListener('touchstart', e => { e.preventDefault(); canvas.dispatchEvent(Object.assign(new MouseEvent('mousedown'), toMouse(e))); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); canvas.dispatchEvent(Object.assign(new MouseEvent('mousemove'), toMouse(e))); }, { passive: false });
  canvas.addEventListener('touchend', () => { canvas.dispatchEvent(new MouseEvent('mouseup')); });

  // ── Export ─────────────────────────────────────────────────────────────────
  function capture() {
    const svg = document.querySelector('svg:not([hidden])');
    if (svg) {
      try {
        const rect = svg.getBoundingClientRect();
        const data = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const exp = document.createElement('canvas');
          exp.width = rect.width * 2; exp.height = rect.height * 2;
          const c = exp.getContext('2d');
          c.scale(2, 2);
          c.drawImage(img, 0, 0, rect.width, rect.height);
          c.drawImage(canvas, -rect.left, -rect.top, window.innerWidth, window.innerHeight);
          URL.revokeObjectURL(url);
          exp.toBlob(b => window.open(URL.createObjectURL(b)), 'image/png');
        };
        img.src = url; return;
      } catch (_) {}
    }
    // Fallback: annotations only (for Canvas-based diagrams — take a screenshot)
    canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'annotation.png'; a.click(); }, 'image/png');
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'Escape') setTool('browse');
    const shortcuts = { p: 'pen', r: 'rect', c: 'circle', a: 'arrow', t: 'text', e: 'erase' };
    if (!e.ctrlKey && !e.metaKey && shortcuts[e.key]) setTool(shortcuts[e.key]);
  });
})();
