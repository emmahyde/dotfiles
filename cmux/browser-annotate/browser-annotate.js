(function() {
  if (window.__annotateOverlay) {
    window.__annotateOverlay.canvas.remove();
    window.__annotateOverlay.badge.remove();
    if (window.__annotateOverlay.hoverOutline) window.__annotateOverlay.hoverOutline.remove();
    if (window.__annotateOverlay.colorPicker) window.__annotateOverlay.colorPicker.remove();
    window.__annotateOverlay = null;
  }

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var operations = [];
  var redoStack = [];
  var selections = [];
  var drawing = false;
  var enabled = false;
  var mode = 'freehand';
  var color = '#ff2222';
  var circleStart = null;
  var currentStroke = null;
  var textInput = null;
  var hoverOutline = null;
  var colorPicker = null;
  var moveTarget = null;   // { opIndex, startX, startY } during drag
  var moveHover = -1;      // index of op under cursor in move mode

  var COLORS = ['#ff2222','#2266ff','#22aa44','#ff8800','#aa22ff','#00cccc','#ff44aa','#ffffff','#000000'];

  Object.assign(canvas.style, {
    position: 'absolute', top: '0', left: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
    cursor: 'default'
  });

  function resize() {
    var w = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    var h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      redraw();
    }
  }
  resize();
  window.addEventListener('resize', resize);
  // watch for content size changes (e.g. lazy-loaded images)
  var resizeObs = new ResizeObserver(resize);
  resizeObs.observe(document.documentElement);
  document.body.appendChild(canvas);

  function setStroke(c) {
    ctx.strokeStyle = c || color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function pageX(clientX) { return clientX + window.scrollX; }
  function pageY(clientY) { return clientY + window.scrollY; }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < operations.length; i++) {
      drawOp(operations[i]);
      if (i === moveHover && !moveTarget) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 6;
        ctx.setLineDash([]);
        drawOpOutline(operations[i]);
        ctx.restore();
      }
    }
    for (var j = 0; j < selections.length; j++) {
      var sel = selections[j];
      var el = sel._el;
      if (!el || !el.isConnected) continue;
      var r = el.getBoundingClientRect();
      var rx = r.x + window.scrollX, ry = r.y + window.scrollY;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rx - 2, ry - 2, r.width + 4, r.height + 4);
      ctx.setLineDash([]);
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#ff8800';
      ctx.fillText('#' + sel.index, rx - 2, ry - 5);
    }
  }

  function drawOp(op) {
    setStroke(op.color);
    if (op.type === 'freehand' && op.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo((op.points[0].x), (op.points[0].y));
      for (var i = 1; i < op.points.length; i++) {
        ctx.lineTo((op.points[i].x), (op.points[i].y));
      }
      ctx.stroke();
    } else if (op.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse((op.cx), (op.cy), op.rx, op.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op.type === 'arrow') {
      drawArrow((op.x1), (op.y1), (op.x2), (op.y2), op.color);
    } else if (op.type === 'text') {
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = op.color || color;
      var lines = op.text.split('\n');
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], op.x, op.y + li * 22);
      }
    }
  }

  function drawOpOutline(op) {
    if (op.type === 'freehand' && op.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo((op.points[0].x), (op.points[0].y));
      for (var i = 1; i < op.points.length; i++) ctx.lineTo((op.points[i].x), (op.points[i].y));
      ctx.stroke();
    } else if (op.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse((op.cx), (op.cy), op.rx, op.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo((op.x1), (op.y1));
      ctx.lineTo((op.x2), (op.y2));
      ctx.stroke();
    } else if (op.type === 'text') {
      ctx.font = 'bold 16px system-ui, sans-serif';
      var tlines = op.text.split('\n');
      var maxW = 0;
      for (var ti = 0; ti < tlines.length; ti++) {
        var w = ctx.measureText(tlines[ti]).width;
        if (w > maxW) maxW = w;
      }
      ctx.strokeRect(op.x - 2, op.y - 16, maxW + 4, tlines.length * 22 + 2);
    }
  }

  function drawArrow(x1, y1, x2, y2, c) {
    var headLen = 14;
    var angle = Math.atan2(y2 - y1, x2 - x1);
    setStroke(c);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  // Hit-test: returns index of operation near (px, py) in page coords, or -1
  function hitTest(px, py) {
    var threshold = 12;
    // iterate backwards so topmost drawn op is picked first
    for (var i = operations.length - 1; i >= 0; i--) {
      var op = operations[i];
      if (op.type === 'freehand') {
        for (var j = 0; j < op.points.length; j++) {
          var dx = op.points[j].x - px, dy = op.points[j].y - py;
          if (dx * dx + dy * dy < threshold * threshold) return i;
        }
      } else if (op.type === 'circle') {
        // hit if near the ellipse edge or inside it
        var ex = (px - op.cx) / (op.rx + threshold);
        var ey = (py - op.cy) / (op.ry + threshold);
        if (ex * ex + ey * ey <= 1) return i;
      } else if (op.type === 'arrow') {
        // distance from point to line segment
        var d = distToSegment(px, py, op.x1, op.y1, op.x2, op.y2);
        if (d < threshold) return i;
      } else if (op.type === 'text') {
        ctx.font = 'bold 16px system-ui, sans-serif';
        var tlines = op.text.split('\n');
        var maxW = 0;
        for (var ti = 0; ti < tlines.length; ti++) {
          var tw = ctx.measureText(tlines[ti]).width;
          if (tw > maxW) maxW = tw;
        }
        var th = tlines.length * 22;
        if (px >= op.x - 4 && px <= op.x + maxW + 4 && py >= op.y - 18 && py <= op.y + th) return i;
      }
    }
    return -1;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function moveOp(op, dx, dy) {
    if (op.type === 'freehand') {
      for (var i = 0; i < op.points.length; i++) {
        op.points[i].x += dx;
        op.points[i].y += dy;
      }
    } else if (op.type === 'circle') {
      op.cx += dx; op.cy += dy;
    } else if (op.type === 'arrow') {
      op.x1 += dx; op.y1 += dy;
      op.x2 += dx; op.y2 += dy;
    } else if (op.type === 'text') {
      op.x += dx; op.y += dy;
    }
  }

  window.addEventListener('scroll', function() {
    if (selections.length > 0) redraw();
  }, { passive: true });

  // Panel (badge + inline color picker)
  var badge = document.createElement('div');
  Object.assign(badge.style, {
    position: 'fixed', top: '8px', right: '8px',
    zIndex: '2147483647',
    borderRadius: '8px',
    fontFamily: 'system-ui, sans-serif', fontSize: '12px',
    color: '#fff', opacity: '0.92',
    transition: 'opacity 0.2s',
    background: 'rgba(24,24,24,0.92)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    pointerEvents: 'auto'
  });
  document.body.appendChild(badge);

  var modeColors = { freehand: '#ff2222', circle: '#2266ff', text: '#22aa44', select: '#ff8800', arrow: '#aa22ff' };
  var modeKeys = { f: 'freehand', s: 'circle', t: 'text', h: 'select', a: 'arrow' };
  var modeIcons = { freehand: '\u270E', arrow: '\u2192', circle: '\u25EF', text: 'T', select: '\u2316' };

  function setMode(newMode) {
    mode = newMode;
    canvas.style.pointerEvents = (enabled && mode !== 'select') ? 'auto' : 'none';
    var cursors = { text: 'text', select: 'default', move: 'default' };
    canvas.style.cursor = enabled ? (cursors[mode] || 'crosshair') : 'default';
    if (hoverOutline) hoverOutline.style.display = 'none';
    moveHover = -1;
    updateBadge();
  }

  function updateBadge() {
    if (!enabled) {
      badge.style.pointerEvents = 'none';
      badge.innerHTML = '<div style="padding:6px 12px;opacity:0.7">Annotate OFF \u2014 Ctrl+D</div>';
      return;
    }
    badge.style.pointerEvents = 'auto';

    var tools = ['freehand','arrow','circle','text','select'];
    var toolNames = { freehand: ['F','reehand'], arrow: ['A','rrow'], circle: ['S','hape'], text: ['T','ext'], select: ['H','ighlight'] };
    var toolBtns = tools.map(function(m) {
      var active = m === mode;
      var bg = active ? modeColors[m] : 'transparent';
      var border = active ? '1px solid ' + modeColors[m] : '1px solid rgba(255,255,255,0.15)';
      var parts = toolNames[m];
      return '<span class="ann-tool" data-mode="' + m + '" style="display:inline-block;padding:3px 8px;' +
        'border-radius:4px;cursor:pointer;background:' + bg + ';border:' + border + ';' +
        'font-size:11px;margin:0 1px">' +
        modeIcons[m] + ' [' + parts[0] + ']' + parts[1] + '</span>';
    }).join('');

    var swatches = COLORS.map(function(c) {
      var sel = c === color;
      return '<span class="ann-color" data-color="' + c + '" style="display:inline-block;width:16px;height:16px;' +
        'border-radius:3px;cursor:pointer;background:' + c + ';' +
        'border:' + (sel ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)') + ';' +
        'margin:0 1px;vertical-align:middle"></span>';
    }).join('');

    var actions = 'Z Undo \u00B7 R Redo \u00B7 C Copy \u00B7 Q Clear \u00B7 Ctrl+D Off';

    badge.innerHTML =
      '<div style="padding:6px 10px 4px">' + toolBtns + '</div>' +
      '<div style="padding:2px 10px 4px;display:flex;align-items:center;gap:2px">' + swatches + '</div>' +
      '<div style="padding:2px 10px 6px;font-size:10px;opacity:0.5">' + actions + '</div>';
  }
  updateBadge();

  // Click handlers for badge buttons (tools + colors)
  badge.addEventListener('click', function(e) {
    var toolEl = e.target.closest('.ann-tool');
    if (toolEl) {
      var m = toolEl.getAttribute('data-mode');
      if (m) setMode(m);
      return;
    }
    var colorEl = e.target.closest('.ann-color');
    if (colorEl) {
      color = colorEl.getAttribute('data-color');
      updateBadge();
    }
  });

  // CSS selector path
  function cssPath(el) {
    var parts = [];
    while (el && el !== document.body && el !== document.documentElement) {
      var seg = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(seg + '#' + el.id); break; }
      if (el.className && typeof el.className === 'string') {
        var cls = el.className.trim().split(/\s+/).slice(0, 3).join('.');
        if (cls) seg += '.' + cls;
      }
      var parent = el.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) {
          return c.tagName === el.tagName;
        });
        if (siblings.length > 1) {
          seg += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
        }
      }
      parts.unshift(seg);
      el = parent;
    }
    return parts.join(' > ');
  }

  // Hover outline for select mode
  hoverOutline = document.createElement('div');
  Object.assign(hoverOutline.style, {
    position: 'fixed', pointerEvents: 'none',
    border: '2px solid #ff8800',
    borderRadius: '2px',
    zIndex: '2147483646',
    display: 'none',
    transition: 'all 0.05s'
  });
  document.body.appendChild(hoverOutline);

  document.addEventListener('mousemove', function(e) {
    if (!enabled || mode !== 'select') {
      hoverOutline.style.display = 'none';
      return;
    }
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === canvas || target === badge || target === hoverOutline || target === colorPicker || (colorPicker && colorPicker.contains(target))) {
      hoverOutline.style.display = 'none';
      return;
    }
    var r = target.getBoundingClientRect();
    hoverOutline.style.display = 'block';
    hoverOutline.style.left = (r.x - 2) + 'px';
    hoverOutline.style.top = (r.y - 2) + 'px';
    hoverOutline.style.width = (r.width + 4) + 'px';
    hoverOutline.style.height = (r.height + 4) + 'px';
  }, true);

  document.addEventListener('click', function(e) {
    if (!enabled || mode !== 'select') return;
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === canvas || target === badge || target === hoverOutline || target === colorPicker || (colorPicker && colorPicker.contains(target))) return;
    e.preventDefault();
    e.stopPropagation();

    // Toggle: if already selected, deselect
    var existingIdx = -1;
    for (var i = 0; i < selections.length; i++) {
      if (selections[i]._el === target) { existingIdx = i; break; }
    }
    if (existingIdx >= 0) {
      target.removeAttribute('data-sel');
      selections.splice(existingIdx, 1);
      // renumber remaining
      for (var k = 0; k < selections.length; k++) {
        selections[k].index = k + 1;
        if (selections[k]._el) selections[k]._el.setAttribute('data-sel', k + 1);
      }
      redraw();
      return;
    }

    var r = target.getBoundingClientRect();
    var text = (target.textContent || '').trim().substring(0, 120);
    var sel = {
      index: selections.length + 1,
      tag: target.tagName.toLowerCase(),
      id: target.id || null,
      classes: target.className && typeof target.className === 'string'
        ? target.className.trim().split(/\s+/).slice(0, 5) : [],
      text: text,
      selector: cssPath(target),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      html: target.outerHTML.substring(0, 300),
      _el: target
    };
    target.setAttribute('data-sel', sel.index);
    selections.push(sel);
    redoStack.length = 0;
    redraw();
  }, true);

  // Text input helper
  function showTextInput(clientX, clientY) {
    if (textInput) textInput.remove();
    textInput = document.createElement('textarea');
    Object.assign(textInput.style, {
      position: 'fixed',
      left: clientX + 'px',
      top: (clientY - 20) + 'px',
      zIndex: '2147483647',
      font: 'bold 16px system-ui, sans-serif',
      color: color,
      background: 'rgba(255,255,255,0.95)',
      border: '2px solid ' + color,
      borderRadius: '3px',
      padding: '4px 8px',
      outline: 'none',
      minWidth: '150px',
      minHeight: '24px',
      maxWidth: '400px',
      resize: 'both',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      lineHeight: '1.3',
      overflow: 'hidden'
    });
    textInput.rows = 1;
    textInput.placeholder = 'Type here \u2014 Shift+Enter for newline, Enter to place';
    document.body.appendChild(textInput);
    canvas.style.pointerEvents = 'none';

    // auto-grow height
    function autoGrow() {
      textInput.style.height = 'auto';
      textInput.style.height = textInput.scrollHeight + 'px';
    }
    textInput.addEventListener('input', autoGrow);

    var px = pageX(clientX);
    var py = pageY(clientY);
    var c = color;
    var committed = false;

    function commit() {
      if (committed) return;
      committed = true;
      var val = textInput.value.trim();
      if (val) {
        operations.push({ type: 'text', x: px, y: py, text: val, color: c });
        redoStack.length = 0;
        redraw();
      }
      if (textInput) textInput.remove();
      textInput = null;
      canvas.style.pointerEvents = (enabled && mode !== 'select') ? 'auto' : 'none';
    }

    function cancel() {
      if (committed) return;
      committed = true;
      if (textInput) textInput.remove();
      textInput = null;
      canvas.style.pointerEvents = (enabled && mode !== 'select') ? 'auto' : 'none';
    }

    textInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      e.stopPropagation();
    });
    // delay blur handler so mouseup doesn't immediately dismiss
    setTimeout(function() {
      if (textInput) textInput.addEventListener('blur', commit);
    }, 200);
    // defer focus to after mouseup settles
    setTimeout(function() {
      if (textInput) textInput.focus();
    }, 50);
  }

  // Mouse handlers for canvas — implicit move: if clicking near an existing
  // annotation, grab it; otherwise draw with the current tool.
  canvas.addEventListener('mousedown', function(e) {
    if (!enabled || mode === 'select') return;

    if (mode === 'text') {
      showTextInput(e.clientX, e.clientY);
      return;
    }

    // Try to grab an existing annotation first
    var idx = hitTest(pageX(e.clientX), pageY(e.clientY));
    if (idx >= 0) {
      moveTarget = { opIndex: idx, startX: pageX(e.clientX), startY: pageY(e.clientY) };
      drawing = true;
      canvas.style.cursor = 'grabbing';
      return;
    }

    drawing = true;
    if (mode === 'freehand') {
      currentStroke = { type: 'freehand', points: [{ x: pageX(e.clientX), y: pageY(e.clientY) }], color: color };
    } else if (mode === 'circle' || mode === 'arrow') {
      circleStart = { clientX: e.clientX, clientY: e.clientY, px: pageX(e.clientX), py: pageY(e.clientY) };
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!enabled) return;

    // Dragging an existing annotation
    if (moveTarget && drawing) {
      var nowX = pageX(e.clientX), nowY = pageY(e.clientY);
      var mdx = nowX - moveTarget.startX, mdy = nowY - moveTarget.startY;
      moveOp(operations[moveTarget.opIndex], mdx, mdy);
      moveTarget.startX = nowX;
      moveTarget.startY = nowY;
      redraw();
      return;
    }

    // Hover: show grab cursor when near an annotation (unless actively drawing)
    if (!drawing && mode !== 'text') {
      var idx = hitTest(pageX(e.clientX), pageY(e.clientY));
      if (idx !== moveHover) {
        moveHover = idx;
        canvas.style.cursor = idx >= 0 ? 'grab' : (mode === 'text' ? 'text' : 'crosshair');
        redraw();
      }
      return;
    }

    if (!drawing) return;
    if (mode === 'freehand' && currentStroke) {
      currentStroke.points.push({ x: pageX(e.clientX), y: pageY(e.clientY) });
      redraw();
      drawOp(currentStroke);
    } else if (mode === 'circle' && circleStart) {
      var dx = e.clientX - circleStart.clientX;
      var dy = e.clientY - circleStart.clientY;
      var rx = Math.abs(dx) / 2;
      var ry = Math.abs(dy) / 2;
      var cx = circleStart.px + dx / 2;
      var cy = circleStart.py + dy / 2;
      redraw();
      setStroke();
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse((cx), (cy), rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (mode === 'arrow' && circleStart) {
      redraw();
      ctx.setLineDash([6, 4]);
      drawArrow(circleStart.px, circleStart.py, pageX(e.clientX), pageY(e.clientY), color);
      ctx.setLineDash([]);
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    if (!drawing || !enabled) return;
    drawing = false;

    if (moveTarget) {
      moveTarget = null;
      moveHover = -1;
      redoStack.length = 0;
      canvas.style.cursor = mode === 'text' ? 'text' : 'crosshair';
      redraw();
      return;
    }

    if (mode === 'freehand' && currentStroke) {
      operations.push(currentStroke);
      redoStack.length = 0;
      currentStroke = null;
      redraw();
    } else if (mode === 'circle' && circleStart) {
      var dx = e.clientX - circleStart.clientX;
      var dy = e.clientY - circleStart.clientY;
      var rx = Math.abs(dx) / 2;
      var ry = Math.abs(dy) / 2;
      if (rx > 2 || ry > 2) {
        operations.push({
          type: 'circle',
          cx: circleStart.px + dx / 2,
          cy: circleStart.py + dy / 2,
          rx: rx, ry: ry,
          color: color
        });
        redoStack.length = 0;
      }
      circleStart = null;
      redraw();
    } else if (mode === 'arrow' && circleStart) {
      var adx = e.clientX - circleStart.clientX;
      var ady = e.clientY - circleStart.clientY;
      if (Math.abs(adx) > 3 || Math.abs(ady) > 3) {
        operations.push({
          type: 'arrow',
          x1: circleStart.px, y1: circleStart.py,
          x2: pageX(e.clientX), y2: pageY(e.clientY),
          color: color
        });
        redoStack.length = 0;
      }
      circleStart = null;
      redraw();
    }
  });

  // Ctrl+D: toggle annotation mode (always active)
  // All other keys: plain keys, only when annotation mode is enabled
  window.addEventListener('keydown', function(e) {
    if (textInput) return;

    // Ctrl+D always works — toggle annotation mode
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      enabled = !enabled;
      setMode(mode);
      return;
    }

    // Everything below: only when enabled, plain keys (no ctrl)
    if (!enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    if (drawing) return; // don't switch modes mid-stroke

    var key = e.key.toLowerCase();

    // Mode switches
    if (modeKeys[key]) {
      e.preventDefault();
      setMode(modeKeys[key]);
      return;
    }

    switch (key) {
      case 'q':
        e.preventDefault();
        selections.forEach(function(s) { if (s._el) s._el.removeAttribute('data-sel'); });
        operations.length = 0;
        redoStack.length = 0;
        selections.length = 0;
        redraw();
        break;

      case 'z':
        e.preventDefault();
        if (selections.length > 0 && (operations.length === 0 ||
            selections[selections.length - 1].index > operations.length)) {
          var removedSel = selections.pop();
          if (removedSel && removedSel._el) removedSel._el.removeAttribute('data-sel');
        } else if (operations.length > 0) {
          redoStack.push(operations.pop());
        }
        redraw();
        break;

      case 'r':
        e.preventDefault();
        if (redoStack.length > 0) {
          operations.push(redoStack.pop());
          redraw();
        }
        break;

      case 'c':
        e.preventDefault();
        if (selections.length === 0) return;
        var lines = selections.map(function(s) {
          return '[sel ' + s.index + '] <' + s.tag +
            (s.id ? '#' + s.id : '') +
            (s.classes.length ? '.' + s.classes.join('.') : '') +
            '> selector="' + s.selector + '"' +
            ' text="' + s.text.substring(0, 60) + '"' +
            ' rect=' + s.rect.x + ',' + s.rect.y + ',' + s.rect.w + 'x' + s.rect.h;
        });
        var output = lines.join('\n');
        navigator.clipboard.writeText(output).then(function() {
          badge.innerHTML = '<span style="color:#22aa44;font-weight:700">Copied ' + selections.length + ' selections!</span>';
          setTimeout(updateBadge, 1500);
        });
        break;

    }
  });

  window.__annotateOverlay = {
    canvas: canvas, badge: badge, hoverOutline: hoverOutline,
    operations: operations, selections: selections, redoStack: redoStack,
    getSelections: function() {
      return selections.map(function(s) {
        return { index: s.index, tag: s.tag, id: s.id, classes: s.classes,
                 text: s.text, selector: s.selector, rect: s.rect, html: s.html };
      });
    }
  };
})();
