/**
 * diagram-toolkit.js — Reusable functions for ERDs, flowcharts, and architecture diagrams.
 *
 * ERD pipeline:   layoutGroups → buildObstacles → routeFK → deduplicateChannels → reconcileDirections → render
 * Flowchart/arch: ELK layout   → renderElkGraph (handles compound nodes, shapes, edge labels)
 * Shared:         pointsToPath, drawHaloLabel, pointInsideEntity, setupTooltip
 *
 * Usage: <script src="/diagram-toolkit.js"></script>
 * All functions are exposed on `window.DT`.
 */
(function (exports) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag) => document.createElementNS(NS, tag);

  // ════════════════════════════════════════════════════════════
  //  SHARED — used by both ERD and flowchart pipelines
  // ════════════════════════════════════════════════════════════

  /** Convert ELK edge sections (or synthetic sections) to an SVG path with rounded corners. */
  function pointsToPath(sections, cornerRadius) {
    const r = cornerRadius ?? 6;
    if (!sections || sections.length === 0) return "";
    let d = "";
    for (const sec of sections) {
      const all = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
      d += `M${all[0].x},${all[0].y}`;
      for (let i = 1; i < all.length; i++) {
        const prev = all[i - 1], curr = all[i];
        if (i < all.length - 1) {
          const next = all[i + 1];
          const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
          const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
          const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const rr = Math.min(r, l1 / 2, l2 / 2);
          d += `L${curr.x - (dx1 / l1) * rr},${curr.y - (dy1 / l1) * rr}`;
          d += `Q${curr.x},${curr.y},${curr.x + (dx2 / l2) * rr},${curr.y + (dy2 / l2) * rr}`;
        } else {
          d += `L${curr.x},${curr.y}`;
        }
      }
    }
    return d;
  }

  /** Draw an inline label using the Observable white-stroke halo technique. */
  function drawHaloLabel(parent, x, y, text, color, opts) {
    const rotated = opts?.rotated ?? false;
    const fontSize = opts?.fontSize ?? "8.5px";
    const fontFamily = opts?.fontFamily ?? "var(--mono)";
    const haloColor = opts?.haloColor ?? "white";
    const haloWidth = opts?.haloWidth ?? 4;

    const lg = svgEl("g");
    if (rotated) lg.setAttribute("transform", `translate(${x},${y}) rotate(-90)`);
    else lg.setAttribute("transform", `translate(${x},${y})`);

    const attrs = { "text-anchor": "middle", "dominant-baseline": "middle", y: 1,
      "font-family": fontFamily, "font-size": fontSize, "font-weight": "600" };

    // Halo
    const halo = svgEl("text");
    Object.entries(attrs).forEach(([k, v]) => halo.setAttribute(k, String(v)));
    halo.setAttribute("stroke", haloColor);
    halo.setAttribute("stroke-width", String(haloWidth));
    halo.setAttribute("stroke-linejoin", "round");
    halo.textContent = text;
    lg.appendChild(halo);

    // Foreground
    const fg = svgEl("text");
    Object.entries(attrs).forEach(([k, v]) => fg.setAttribute(k, String(v)));
    fg.setAttribute("fill", color);
    fg.textContent = text;
    lg.appendChild(fg);

    parent.appendChild(lg);
    return lg;
  }

  /** Simple fixed-position tooltip manager. */
  function setupTooltip(tipEl) {
    return {
      show(e, html) { tipEl.innerHTML = html; tipEl.style.opacity = 1; this.move(e); },
      move(e) { tipEl.style.left = (e.clientX + 14) + "px"; tipEl.style.top = (e.clientY + 14) + "px"; },
      hide() { tipEl.style.opacity = 0; },
    };
  }

  // ════════════════════════════════════════════════════════════
  //  ERD — group-based layout, obstacle-aware routing, crow's foot
  // ════════════════════════════════════════════════════════════

  /**
   * Compute absolute positions for tables arranged in vertical subgraph groups.
   * @param {Array} groups - [{id, label, bg, border, tableIds}]
   * @param {Object} tableMap - {id: tableObj} where tableObj has `columns`
   * @param {Object} opts - {colW, rowH, headerH, tableGap, groupGap, groupPad, groupTitleH}
   * @returns {{nodePos, groups}} nodePos[tableId] = {x, y, width, height, _meta}
   */
  function layoutGroups(groups, tableMap, opts) {
    const { colW, rowH, headerH, tableGap, groupGap, groupPad, groupTitleH } = opts;
    const tableH = (t) => headerH + t.columns.length * rowH + 6;

    groups.forEach(grp => {
      const gTables = grp.tableIds.map(id => tableMap[id]);
      grp.innerH = Math.max(...gTables.map(t => tableH(t)));
      grp.innerW = gTables.length * colW + (gTables.length - 1) * tableGap;
      grp.outerW = grp.innerW + 2 * groupPad;
      grp.outerH = grp.innerH + groupPad + groupTitleH;
    });

    const maxGroupW = Math.max(...groups.map(g => g.outerW));
    let currentY = 0;
    const nodePos = {};

    groups.forEach(grp => {
      grp.x = (maxGroupW - grp.outerW) / 2;
      grp.y = currentY;
      currentY += grp.outerH + groupGap;

      let tableX = grp.x + groupPad;
      const tableY = grp.y + groupTitleH;
      grp.tableIds.forEach(id => {
        const t = tableMap[id];
        nodePos[id] = { x: tableX, y: tableY, width: colW, height: tableH(t), _meta: t };
        tableX += colW + tableGap;
      });
    });

    return { nodePos, groups, totalHeight: currentY, maxWidth: maxGroupW };
  }

  /**
   * Precompute obstacle bounding boxes (tables + groups) with a given margin.
   * @returns {Array<{id, x1, y1, x2, y2}>}
   */
  function buildObstacles(nodePos, groups, margin) {
    const obs = [];
    Object.values(nodePos).forEach(n => {
      obs.push({ id: n._meta?.id, x1: n.x - margin, y1: n.y - margin, x2: n.x + n.width + margin, y2: n.y + n.height + margin });
    });
    (groups || []).forEach(grp => {
      obs.push({ id: grp.id, x1: grp.x - margin, y1: grp.y - margin, x2: grp.x + grp.outerW + margin, y2: grp.y + grp.outerH + margin });
    });
    return obs;
  }

  /** Check if a point is inside any obstacle bounding box. */
  function pointInsideEntity(px, py, obstacles) {
    for (const ob of obstacles) {
      if (px >= ob.x1 && px <= ob.x2 && py >= ob.y1 && py <= ob.y2) return true;
    }
    return false;
  }

  // Internal helpers for routing
  function _vClear(x, yMin, yMax, obstacles, excludeSet) {
    for (const ob of obstacles) {
      if (excludeSet.has(ob.id)) continue;
      if (x >= ob.x1 && x <= ob.x2 && yMax >= ob.y1 && yMin <= ob.y2) return false;
    }
    return true;
  }

  function _hClear(x1, x2, y, obstacles, excludeSet) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    for (const ob of obstacles) {
      if (excludeSet.has(ob.id)) continue;
      if (y >= ob.y1 && y <= ob.y2 && maxX >= ob.x1 && minX <= ob.x2) return false;
    }
    return true;
  }

  function _findChannel(preferredX, yMin, yMax, obstacles, excludeSet, searchDir, step, maxSearch) {
    if (_vClear(preferredX, yMin, yMax, obstacles, excludeSet)) return preferredX;
    for (let off = step; off < maxSearch; off += step) {
      if (searchDir >= 0) { const x = preferredX + off; if (_vClear(x, yMin, yMax, obstacles, excludeSet)) return x; }
      if (searchDir <= 0) { const x = preferredX - off; if (_vClear(x, yMin, yMax, obstacles, excludeSet)) return x; }
    }
    return preferredX;
  }

  function _scoreRoute(sx, sy, midX, ty, tx, obstacles, excludeSet, penH, penV) {
    let p = 0;
    if (!_hClear(sx, midX, sy, obstacles, excludeSet)) p += penH;
    if (!_hClear(midX, tx, ty, obstacles, excludeSet)) p += penH;
    if (!_vClear(midX, Math.min(sy, ty), Math.max(sy, ty), obstacles, excludeSet)) p += penV;
    return p;
  }

  /**
   * Compute an obstacle-aware orthogonal route between a FK row and a PK row.
   * Tries four direction combos (R→L, L→R, R→R, L→L) and picks the lowest-penalty route.
   * @returns {{sx, sy, tx, ty, midX, srcDir, tgtDir}}
   */
  function routeFK(srcNode, srcColIdx, tgtNode, tgtColIdx, obstacles, opts) {
    const { colW, headerH, rowH, markGap, edgeMargin,
            channelStep = 16, channelMax = 600, penH = 100, penV = 50 } = opts;

    const sy = srcNode.y + headerH + srcColIdx * rowH + rowH / 2;
    const ty = tgtNode.y + headerH + tgtColIdx * rowH + rowH / 2;
    const srcRight = srcNode.x + colW, srcLeft = srcNode.x;
    const tgtRight = tgtNode.x + colW, tgtLeft = tgtNode.x;
    const yMin = Math.min(sy, ty), yMax = Math.max(sy, ty);
    const excludeIds = [srcNode._meta?.id, tgtNode._meta?.id];
    const exSet = new Set(excludeIds);

    const candidates = [];
    const tryCandidate = (sx, tx, preferred, srcDir, tgtDir, dir) => {
      const mx = _findChannel(preferred, yMin, yMax, obstacles, exSet, dir, channelStep, channelMax);
      candidates.push({ sx, tx, midX: mx, srcDir, tgtDir });
    };

    // A: src RIGHT → tgt LEFT
    if (srcRight < tgtLeft + colW)
      tryCandidate(srcRight, tgtLeft, (srcRight + tgtLeft) / 2, "right", "left", 0);
    // B: src LEFT → tgt RIGHT
    if (srcLeft > tgtRight - colW)
      tryCandidate(srcLeft, tgtRight, (srcLeft + tgtRight) / 2, "left", "right", 0);
    // C: both RIGHT
    tryCandidate(srcRight, tgtRight, Math.max(srcRight, tgtRight) + edgeMargin * 2, "right", "right", 1);
    // D: both LEFT
    tryCandidate(srcLeft, tgtLeft, Math.min(srcLeft, tgtLeft) - edgeMargin * 2, "left", "left", -1);

    let best = candidates[0], bestScore = Infinity;
    for (const c of candidates) {
      const s = _scoreRoute(c.sx, sy, c.midX, ty, c.tx, obstacles, exSet, penH, penV);
      if (s < bestScore) { bestScore = s; best = c; }
    }

    return { sx: best.sx, sy, tx: best.tx, ty, midX: best.midX,
             srcDir: best.srcDir, tgtDir: best.tgtDir, excludeIds };
  }

  /**
   * Separate overlapping vertical channels by nudging midX values apart.
   * Re-checks obstacle clearance after each nudge.
   */
  function deduplicateChannels(routes, obstacles, opts) {
    const { minDist = 14, nudge = 18, channelStep = 16, channelMax = 600 } = opts || {};
    const sorted = [...routes].sort((a, b) => a.midX - b.midX);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (Math.abs(sorted[i].midX - sorted[j].midX) < minDist) {
          const r = sorted[j];
          const exSet = new Set(r.excludeIds);
          const yMin = Math.min(r.sy, r.ty), yMax = Math.max(r.sy, r.ty);
          r.midX = _findChannel(r.midX + nudge, yMin, yMax, obstacles, exSet, 1, channelStep, channelMax);
        }
      }
    }
    return sorted;
  }

  /**
   * After dedup, sync sx/tx/srcDir/tgtDir with the final midX position.
   * Ensures cardinality marks face the direction the path actually approaches from.
   */
  function reconcileDirections(routes, nodePos, colW) {
    routes.forEach(r => {
      const src = nodePos[r.excludeIds?.[0]];
      const tgt = nodePos[r.excludeIds?.[1]];
      if (!src || !tgt) return;
      if (r.midX >= src.x + colW / 2) { r.srcDir = "right"; r.sx = src.x + colW; }
      else { r.srcDir = "left"; r.sx = src.x; }
      if (r.midX >= tgt.x + colW / 2) { r.tgtDir = "right"; r.tx = tgt.x + colW; }
      else { r.tgtDir = "left"; r.tx = tgt.x; }
    });
    return routes;
  }

  /**
   * Draw crow's foot cardinality notation at one endpoint of a relationship line.
   * @param exitDir - "left" or "right": direction FROM table edge TOWARD line center
   * @param maxCard - "one" or "many"
   * @param minCard - "one" or "zero"
   */
  function drawCardinality(parent, tableX, y, exitDir, maxCard, minCard, color, markGap) {
    const sign = exitDir === "right" ? 1 : -1;
    const spread = 7, sw = 1.6;
    const mg = markGap || 18;

    if (maxCard === "many") {
      const prongsX = tableX + sign * 4, tipX = tableX + sign * 12;
      parent.append("line").attr("x1", prongsX).attr("y1", y - spread).attr("x2", tipX).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", sw);
      parent.append("line").attr("x1", prongsX).attr("y1", y + spread).attr("x2", tipX).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", sw);
      parent.append("line").attr("x1", tipX).attr("y1", y).attr("x2", tableX + sign * mg).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", 1.4).attr("stroke-opacity", 0.45);
    } else {
      const tx = tableX + sign * 5;
      parent.append("line").attr("x1", tx).attr("y1", y - spread).attr("x2", tx).attr("y2", y + spread)
        .attr("stroke", color).attr("stroke-width", sw);
      parent.append("line").attr("x1", tx).attr("y1", y).attr("x2", tableX + sign * mg).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", 1.4).attr("stroke-opacity", 0.45);
    }

    const innerX = tableX + sign * (maxCard === "many" ? 14 : 9);
    if (minCard === "zero") {
      parent.append("circle").attr("cx", innerX).attr("cy", y).attr("r", 4)
        .attr("fill", "var(--surface)").attr("stroke", color).attr("stroke-width", sw);
    } else {
      parent.append("line").attr("x1", innerX).attr("y1", y - spread).attr("x2", innerX).attr("y2", y + spread)
        .attr("stroke", color).attr("stroke-width", sw);
    }
  }

  /**
   * Draw a single ERD table: border, header bar, column rows with PK/FK badges.
   * @param parent - d3 selection to append to
   * @param node - {x, y, width, height}
   * @param table - {label, color, dashed, columns: [{name, type, pk, fk, group}]}
   * @param opts - {colW, rowH, headerH, pad}
   */
  function drawTable(parent, node, table, opts) {
    const { colW, rowH, headerH, pad } = opts;
    const h = node.height;
    const g = parent.append("g").attr("transform", `translate(${node.x},${node.y})`);

    g.append("rect").attr("width", colW).attr("height", h).attr("rx", 6)
      .attr("fill", "var(--surface)").attr("stroke", table.color).attr("stroke-width", 2)
      .attr("stroke-dasharray", table.dashed ? "6,3" : "none");
    g.append("rect").attr("width", colW).attr("height", headerH).attr("rx", 6).attr("fill", table.color);
    g.append("rect").attr("width", colW).attr("height", 6).attr("y", headerH - 6).attr("fill", table.color);

    g.append("text").attr("x", pad).attr("y", headerH / 2 + 1)
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px").attr("font-weight", 700).attr("fill", "white")
      .attr("font-family", "var(--font)")
      .text(table.label);

    if (table.dashed) {
      g.append("text").attr("x", colW - pad).attr("y", headerH / 2 + 1)
        .attr("dominant-baseline", "middle").attr("text-anchor", "end")
        .attr("font-size", "9px").attr("fill", "rgba(255,255,255,.7)")
        .attr("font-family", "var(--mono)")
        .text("virtual");
    }

    table.columns.forEach((col, i) => {
      const y = headerH + i * rowH + rowH / 2;
      if (i > 0) {
        g.append("line").attr("x1", 0).attr("x2", colW)
          .attr("y1", headerH + i * rowH).attr("y2", headerH + i * rowH)
          .attr("stroke", "var(--surface-dim)").attr("stroke-width", 0.5);
      }
      if (col.group && (i === 0 || table.columns[i - 1].group !== col.group)) {
        g.append("line").attr("x1", 0).attr("x2", colW)
          .attr("y1", headerH + i * rowH).attr("y2", headerH + i * rowH)
          .attr("stroke", "var(--text-faint)").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,2");
      }
      const badgeW = col.pk ? 18 : col.fk ? 18 : 0;
      if (col.pk) {
        g.append("text").attr("x", pad).attr("y", y).attr("dominant-baseline", "middle")
          .attr("font-family", "var(--mono)").attr("font-size", "8px")
          .attr("fill", "var(--highlight)").attr("font-weight", 700).text("PK");
      } else if (col.fk) {
        g.append("text").attr("x", pad).attr("y", y).attr("dominant-baseline", "middle")
          .attr("font-family", "var(--mono)").attr("font-size", "8px")
          .attr("fill", "var(--blue)").attr("font-weight", 600).text("FK");
      }
      g.append("text").attr("x", pad + badgeW + 4).attr("y", y).attr("dominant-baseline", "middle")
        .attr("font-family", "var(--mono)").attr("font-size", "10.5px")
        .attr("fill", col.group ? "var(--purple)" : "var(--text)")
        .text(col.name);
      g.append("text").attr("x", colW - pad).attr("y", y)
        .attr("dominant-baseline", "middle").attr("text-anchor", "end")
        .attr("font-family", "var(--mono)").attr("font-size", "9px")
        .attr("fill", "var(--text-faint)")
        .text(col.group || col.type);
    });

    return g;
  }

  /** Draw a subgraph group background with title. */
  function drawGroupBackground(parent, grp) {
    parent.append("rect")
      .attr("x", grp.x).attr("y", grp.y)
      .attr("width", grp.outerW).attr("height", grp.outerH)
      .attr("rx", 10).attr("fill", grp.bg)
      .attr("stroke", grp.border).attr("stroke-width", 1);
    parent.append("text")
      .attr("x", grp.x + 16).attr("y", grp.y + 15)
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px").attr("font-weight", 600)
      .attr("fill", grp.border.replace(/[\d.]+\)/, "0.7)"))
      .attr("font-family", "var(--font)")
      .attr("letter-spacing", "0.04em")
      .text(grp.label.toUpperCase());
  }

  // ════════════════════════════════════════════════════════════
  //  FLOWCHART / ARCHITECTURE — ELK-based layout with compound nodes
  // ════════════════════════════════════════════════════════════

  /** Shape factory: draws different SVG shapes per layer type. */
  function drawShape(parent, w, h, layer, colors, dashed) {
    const s = svgEl;
    const shape = s("g");

    if (layer === "hook") {
      const r = s("rect");
      r.setAttribute("width", w); r.setAttribute("height", h);
      r.setAttribute("rx", String(h / 2)); r.setAttribute("ry", String(h / 2));
      r.setAttribute("fill", colors.fill); r.setAttribute("stroke", colors.stroke);
      r.setAttribute("stroke-width", "2");
      shape.appendChild(r);

    } else if (layer === "cognitive") {
      const inset = 12;
      const p = s("polygon");
      p.setAttribute("points", `${inset},0 ${w-inset},0 ${w},${h/2} ${w-inset},${h} ${inset},${h} 0,${h/2}`);
      p.setAttribute("fill", colors.fill); p.setAttribute("stroke", colors.stroke); p.setAttribute("stroke-width", "1.5");
      shape.appendChild(p);

    } else if (layer === "retrieval" || layer === "graph") {
      const skew = 10;
      const p = s("polygon");
      p.setAttribute("points", `${skew},0 ${w},0 ${w-skew},${h} 0,${h}`);
      p.setAttribute("fill", colors.fill); p.setAttribute("stroke", colors.stroke); p.setAttribute("stroke-width", "1.5");
      shape.appendChild(p);

    } else if (layer === "storage") {
      const ry = 7;
      const capFill = colors.stroke + "25";
      const bot = s("ellipse");
      bot.setAttribute("cx", w/2); bot.setAttribute("cy", String(h - ry));
      bot.setAttribute("rx", w/2); bot.setAttribute("ry", String(ry));
      bot.setAttribute("fill", "var(--surface)"); bot.setAttribute("stroke", colors.stroke); bot.setAttribute("stroke-width", "1.5");
      if (dashed) bot.setAttribute("stroke-dasharray", "5,3");
      shape.appendChild(bot);
      const body = s("rect");
      body.setAttribute("x", "0"); body.setAttribute("y", String(ry));
      body.setAttribute("width", w); body.setAttribute("height", h - 2 * ry);
      body.setAttribute("fill", "var(--surface)"); body.setAttribute("stroke", "none");
      shape.appendChild(body);
      [0, w].forEach(x => {
        const line = s("line");
        line.setAttribute("x1", x); line.setAttribute("y1", String(ry));
        line.setAttribute("x2", x); line.setAttribute("y2", String(h - ry));
        line.setAttribute("stroke", colors.stroke); line.setAttribute("stroke-width", "1.5");
        if (dashed) line.setAttribute("stroke-dasharray", "5,3");
        shape.appendChild(line);
      });
      const top = s("ellipse");
      top.setAttribute("cx", w/2); top.setAttribute("cy", String(ry));
      top.setAttribute("rx", w/2); top.setAttribute("ry", String(ry));
      top.setAttribute("fill", capFill); top.setAttribute("stroke", colors.stroke); top.setAttribute("stroke-width", "1.5");
      if (dashed) top.setAttribute("stroke-dasharray", "5,3");
      shape.appendChild(top);

    } else if (layer === "infra") {
      const r = s("rect");
      r.setAttribute("width", w); r.setAttribute("height", h);
      r.setAttribute("rx", "6"); r.setAttribute("fill", colors.fill); r.setAttribute("stroke", colors.stroke);
      r.setAttribute("stroke-width", "1.5"); r.setAttribute("stroke-dasharray", "4,3");
      shape.appendChild(r);

    } else {
      const r = s("rect");
      r.setAttribute("width", w); r.setAttribute("height", h);
      r.setAttribute("rx", "4"); r.setAttribute("fill", colors.fill); r.setAttribute("stroke", colors.stroke);
      r.setAttribute("stroke-width", "1.5");
      shape.appendChild(r);
    }

    parent.appendChild(shape);
    return shape;
  }

  /**
   * Render a compound node group background (for ELK subgraphs).
   * @param groupColors - map of layerName → {bg, border, text}
   */
  function drawCompoundBackground(parent, node, groupColors) {
    const gc = groupColors?.[node._meta?.layer] ||
      { bg: "rgba(107,114,128,.05)", border: "rgba(107,114,128,.2)", text: "rgba(107,114,128,.6)" };

    const g = svgEl("g");
    g.setAttribute("transform", `translate(${node.x},${node.y})`);
    const bg = svgEl("rect");
    bg.setAttribute("width", node.width); bg.setAttribute("height", node.height);
    bg.setAttribute("rx", "10"); bg.setAttribute("fill", gc.bg);
    bg.setAttribute("stroke", gc.border); bg.setAttribute("stroke-width", "1");
    g.appendChild(bg);
    const title = svgEl("text");
    title.setAttribute("x", "14"); title.setAttribute("y", "18");
    title.setAttribute("dominant-baseline", "middle");
    title.setAttribute("font-size", "11px"); title.setAttribute("font-weight", "600");
    title.setAttribute("fill", gc.text);
    title.setAttribute("font-family", "var(--font)");
    title.setAttribute("letter-spacing", "0.04em");
    title.textContent = (node._meta?.label || "").toUpperCase();
    g.appendChild(title);
    parent.appendChild(g);
    return g;
  }

  /**
   * Resolve absolute positions from ELK's hierarchical layout.
   * Recursively adds parent offsets to child positions.
   * Draws compound node backgrounds when encountered.
   * @returns {Object} nodeMap — flat map of all nodes with absolute positions
   */
  function resolveElkPositions(laidRoot, svgGroup, groupColors) {
    const nodeMap = {};
    function walk(parent, offsetX, offsetY) {
      (parent.children || []).forEach(n => {
        n.x += offsetX;
        n.y += offsetY;
        nodeMap[n.id] = n;
        if (n.children && n.children.length > 0) {
          drawCompoundBackground(svgGroup, n, groupColors);
          walk(n, n.x, n.y);
        }
      });
    }
    walk(laidRoot, 0, 0);
    return nodeMap;
  }

  /**
   * Full ELK→SVG renderer for flowcharts and architecture diagrams.
   * Handles compound nodes, per-layer shapes, edge labels, and tooltips.
   * @param containerId - DOM element ID to render into
   * @param graphDef - ELK graph definition (with compound children if needed)
   * @param edgeMeta - [{id, label?, color?, width?, dash?}]
   * @param opts - {colors, groupColors, tooltip}
   */
  async function renderElkGraph(elk, containerId, graphDef, edgeMeta, opts) {
    const { colors, groupColors, tooltip } = opts || {};
    const laid = await elk.layout(graphDef);
    const W = laid.width + 40, H = laid.height + 40;
    const wrap = document.getElementById(containerId);
    wrap.innerHTML = "";

    const svg = svgEl("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", Math.min(W, 1440));
    svg.setAttribute("height", Math.min(H, 900));
    wrap.appendChild(svg);

    // Arrow markers
    const defs = svgEl("defs");
    const mkMarker = (id, fill) => {
      const m = svgEl("marker");
      m.setAttribute("id", id); m.setAttribute("viewBox", "0 0 8 6");
      m.setAttribute("refX", "8"); m.setAttribute("refY", "3");
      m.setAttribute("markerWidth", "7"); m.setAttribute("markerHeight", "5");
      m.setAttribute("orient", "auto");
      const p = svgEl("path");
      p.setAttribute("d", "M0,0.5 L8,3 L0,5.5"); p.setAttribute("fill", fill);
      m.appendChild(p);
      return m;
    };
    defs.appendChild(mkMarker(`ah-${containerId}`, "rgba(10,128,128,.4)"));
    defs.appendChild(mkMarker(`ah-hl-${containerId}`, "rgba(244,93,72,.45)"));
    defs.appendChild(mkMarker(`ah-st-${containerId}`, "rgba(217,119,6,.4)"));
    svg.appendChild(defs);

    const g = svgEl("g");
    g.setAttribute("transform", "translate(20,20)");
    svg.appendChild(g);

    const edgeMetaMap = {};
    (edgeMeta || []).forEach(em => { edgeMetaMap[em.id] = em; });

    // Edges
    (laid.edges || []).forEach(edge => {
      const em = edgeMetaMap[edge.id] || {};
      const path = svgEl("path");
      path.setAttribute("d", pointsToPath(edge.sections));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", em.color || "rgba(10,128,128,.25)");
      path.setAttribute("stroke-width", em.width || "1.2");
      if (em.dash) path.setAttribute("stroke-dasharray", em.dash);
      const markerRef = em.color?.includes("244,93,72") ? `ah-hl-${containerId}` :
                        em.color?.includes("217,119,6") ? `ah-st-${containerId}` :
                        `ah-${containerId}`;
      path.setAttribute("marker-end", `url(#${markerRef})`);
      g.appendChild(path);

      if (em.label && edge.sections?.[0]) {
        const sec = edge.sections[0];
        const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
        let bestLen = 0, mx = 0, my = 0, isVert = false;
        for (let j = 0; j < pts.length - 1; j++) {
          const dx = pts[j+1].x - pts[j].x, dy = pts[j+1].y - pts[j].y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len > bestLen) { bestLen = len; mx = (pts[j].x + pts[j+1].x)/2; my = (pts[j].y + pts[j+1].y)/2; isVert = Math.abs(dy) > Math.abs(dx); }
        }
        const edgeColor = em.color || "rgba(10,128,128,.25)";
        const labelColor = edgeColor.replace(/,\s*[\d.]+\)/, ",0.7)");
        drawHaloLabel(g, mx, my, em.label, labelColor, { rotated: isVert });
      }
    });

    // Nodes (resolve compound positions, draw backgrounds)
    const nodeMap = resolveElkPositions(laid, g, groupColors);

    Object.values(nodeMap).forEach(n => {
      if (!n._meta) return;
      const meta = n._meta;
      if (meta.isGroup) return;
      const c = colors?.[meta.layer] || { fill: "rgba(107,114,128,.1)", stroke: "#6b7280" };

      const ng = svgEl("g");
      ng.setAttribute("transform", `translate(${n.x},${n.y})`);
      ng.style.cursor = "pointer";

      drawShape(ng, n.width, n.height, meta.layer, c, meta.dashed);

      const label = svgEl("text");
      label.setAttribute("x", String(n.width / 2));
      label.setAttribute("y", meta.sub ? String(n.height / 2 - 5) : String(n.height / 2 + 1));
      label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("font-size", "11px"); label.setAttribute("font-weight", "600");
      label.setAttribute("fill", "#1a2a2a"); label.setAttribute("font-family", "var(--font)");
      label.textContent = meta.label;
      ng.appendChild(label);

      if (meta.sub) {
        const sub = svgEl("text");
        sub.setAttribute("x", String(n.width / 2)); sub.setAttribute("y", String(n.height / 2 + 10));
        sub.setAttribute("text-anchor", "middle"); sub.setAttribute("dominant-baseline", "middle");
        sub.setAttribute("font-size", "9px"); sub.setAttribute("fill", "#9ca3af");
        sub.setAttribute("font-family", "var(--mono)");
        sub.textContent = meta.sub;
        ng.appendChild(sub);
      }

      if (meta.desc && tooltip) {
        ng.addEventListener("mouseenter", e => tooltip.show(e, `<b>${meta.label}</b><span class="tf">${meta.file || ""}</span>${meta.desc}`));
        ng.addEventListener("mousemove", e => tooltip.move(e));
        ng.addEventListener("mouseleave", () => tooltip.hide());
      }

      g.appendChild(ng);
    });
  }

  // ════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════

  exports.DT = {
    // Shared
    pointsToPath,
    drawHaloLabel,
    setupTooltip,
    pointInsideEntity,

    // ERD pipeline
    layoutGroups,
    buildObstacles,
    routeFK,
    deduplicateChannels,
    reconcileDirections,
    drawCardinality,
    drawTable,
    drawGroupBackground,

    // Flowchart / architecture
    drawShape,
    drawCompoundBackground,
    resolveElkPositions,
    renderElkGraph,
  };

})(window);
