// Reusable accessible-dialog behavior: focus trap, focus restore, Escape.
// Used by popup.js (dark theme) and the Catan modals (light theme, Plan 3).
// Visual styling is the caller's concern; this only manages focus + keys.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus inside `container`, remembering and restoring the previously
 * focused element. Returns a release() function that removes the trap and
 * restores focus.
 *
 * @param {HTMLElement} container
 * @param {object} [opts]
 * @param {() => void} [opts.onEscape] called when Escape is pressed
 * @param {HTMLElement} [opts.initialFocus] element to focus on open
 */
export function trapFocus(container, opts = {}) {
  const previouslyFocused = document.activeElement;

  const focusables = () =>
    Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );

  function onKeydown(e) {
    if (e.key === 'Escape' && opts.onEscape) {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !container.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', onKeydown, true);

  const target = opts.initialFocus || focusables()[0] || container;
  // Defer so the element is in the DOM/visible before focusing.
  requestAnimationFrame(() => { try { target.focus(); } catch {} });

  return function release() {
    document.removeEventListener('keydown', onKeydown, true);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try { previouslyFocused.focus(); } catch {}
    }
  };
}
