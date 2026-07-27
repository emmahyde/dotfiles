/**
 * Init Script Overlay
 * Law 21: Inject via init scripts for persistence
 *
 * This script survives page navigations when registered via addInitScript
 * (Playwright, Puppeteer, cmux, etc.). Handles both immediate DOM and
 * late DOMContentLoaded injection.
 *
 * Usage with Playwright:
 *   await page.addInitScript(fs.readFileSync('init-script-overlay.js', 'utf-8'));
 *   await page.evaluate(() => window.__agentSurface.getState());
 *
 * Usage with Puppeteer:
 *   await page.evaluateOnNewDocument(() => {
 *     // paste this script
 *   });
 */

(function initializeOverlay() {
  /**
   * Initialize the annotation overlay.
   * Called when DOM is ready.
   */
  function initOverlay() {
    // Initialize global surface API if not already present
    if (!window.__agentSurface) {
      // Embed the global-surface-api.js initialization here
      // In practice, you'd include it inline or load it from a CDN
      window.__agentSurface = {
        getState: function() {
          return {
            selections: [],
            annotations: [],
            mode: 'active',
            timestamp: new Date().toISOString(),
          };
        },
        clear: function() {},
        _setMode: function(mode) {},
        _addSelection: function(sel) {},
        _addAnnotation: function(ann) {},
      };
    }

    // Mark overlay as initialized
    window.__agentOverlayReady = true;

    // Emit a custom event so host code knows the overlay is ready
    if (typeof window !== 'undefined' && window.document) {
      const readyEvent = new CustomEvent('agentsurface:ready', {
        detail: { timestamp: Date.now() },
      });
      window.document.dispatchEvent(readyEvent);
    }
  }

  // Handle both cases:
  // 1. Script injected after page load: document.body already exists
  // 2. Script injected before page load: wait for DOMContentLoaded

  if (document.body) {
    // DOM is ready now, initialize immediately
    initOverlay();
  } else {
    // DOM not yet ready, wait for it
    document.addEventListener('DOMContentLoaded', initOverlay, {
      once: true,
    });
  }

  // Also listen for navigations within a single-page app
  // Re-initialize overlay if needed
  if (window.history) {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      const result = originalPushState.apply(window.history, args);
      // Overlay persists across pushState in SPA
      window.__agentSurface?._setMode?.('active');
      return result;
    };

    window.history.replaceState = function(...args) {
      const result = originalReplaceState.apply(window.history, args);
      window.__agentSurface?._setMode?.('active');
      return result;
    };
  }
})();
