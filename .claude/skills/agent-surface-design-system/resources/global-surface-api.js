/**
 * Global Surface API
 * Law 20: Expose a global handle for programmatic access
 *
 * Exposes a serializable namespace on `window` so the agent CLI or host
 * environment can read surface state without modifying DOM.
 *
 * Usage in browser:
 *   window.__agentSurface.getState()
 *   // Returns: { selections: [...], annotations: [...], mode: '...' }
 *
 * Usage in agent CLI:
 *   cmux browser eval 'JSON.stringify(window.__agentSurface.getState())'
 *   # Returns JSON with private _el references stripped
 */

(function initializeAgentSurface() {
  const state = {
    selections: [],
    annotations: [],
    mode: 'inactive',
  };

  window.__agentSurface = {
    /**
     * Get current surface state (serializable, stripped of DOM refs).
     * Strips internal `_el` references so output is safe to JSON.stringify().
     * @returns {Object} Serializable state snapshot
     */
    getState: function() {
      return {
        selections: state.selections.map(sel => ({
          type: sel.type,
          text: sel.text,
          elementId: sel.elementId,
          selector: sel.selector,
          position: sel.position,
          htmlHint: sel.htmlHint,
          computedStyle: sel.computedStyle,
          // _el is intentionally excluded (private reference)
        })),
        annotations: state.annotations.map(ann => ({
          id: ann.id,
          target: ann.target,
          label: ann.label,
          comment: ann.comment,
          markKind: ann.markKind,
          bounds: ann.bounds,
          // _element excluded (private reference)
        })),
        mode: state.mode,
        timestamp: new Date().toISOString(),
      };
    },

    /**
     * Record a selection (internal use by overlay).
     * @param {Object} selection with _el, type, text, etc.
     */
    _addSelection: function(selection) {
      state.selections.push(selection);
    },

    /**
     * Record an annotation (internal use by overlay).
     * @param {Object} annotation with _element, comment, etc.
     */
    _addAnnotation: function(annotation) {
      state.annotations.push(annotation);
    },

    /**
     * Clear all selections and annotations.
     */
    clear: function() {
      state.selections = [];
      state.annotations = [];
      state.mode = 'inactive';
    },

    /**
     * Set current mode ('inactive', 'selecting', 'annotating', etc.).
     * @param {string} mode
     */
    _setMode: function(mode) {
      state.mode = mode;
    },
  };
})();
