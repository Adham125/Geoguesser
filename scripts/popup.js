// Modal-style UI replacements for window.alert / window.confirm.
// `showMessage` → OK-only dialog. `showConfirm` → OK/Cancel dialog.
// Both return a Promise that resolves when the user dismisses the popup.
// Styles are self-injected on first use so consumers just need to import.

let stylesInjected = false;
let rootEl = null;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #popup-root { position: fixed; inset: 0; pointer-events: none; z-index: 10000; }
    .popup-overlay {
      position: absolute; inset: 0;
      background: rgba(8, 12, 20, 0.62);
      backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
      animation: popup-fade 0.18s ease-out;
    }
    @keyframes popup-fade { from {opacity:0;} to {opacity:1;} }
    .popup-card {
      background: var(--color-surface, #1F2937);
      border: 1px solid var(--color-border, #334155);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.45));
      padding: 24px;
      max-width: min(460px, 90vw);
      color: var(--color-fg, #E2E8F0);
      animation: popup-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popup-pop { from {transform:scale(0.94); opacity:0;} to {transform:scale(1); opacity:1;} }
    .popup-title {
      margin: 0 0 10px;
      font-family: var(--font-heading, inherit);
      font-size: 18px; font-weight: 600;
      color: var(--color-fg, #E2E8F0);
    }
    .popup-message {
      margin: 0 0 20px;
      font-family: var(--font-body, inherit);
      line-height: 1.5; font-size: 15px;
      color: var(--color-fg, #E2E8F0);
      white-space: pre-wrap;
    }
    .popup-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .popup-btn {
      appearance: none;
      border: 1px solid var(--color-border, #334155);
      background: var(--color-surface-2, #273244);
      color: var(--color-fg, #E2E8F0);
      padding: 8px 18px;
      border-radius: var(--radius-md, 8px);
      font-family: var(--font-body, inherit);
      font-size: 14px; cursor: pointer;
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }
    .popup-btn:hover { background: var(--color-surface-3, rgba(255,255,255,0.08)); }
    .popup-btn:focus-visible { outline: 2px solid var(--color-ring, #60A5FA); outline-offset: 2px; }
    .popup-btn--primary {
      background: var(--color-accent, #F59E0B);
      color: #1F2937;
      border-color: var(--color-accent, #F59E0B);
      font-weight: 600;
    }
    .popup-btn--primary:hover { background: var(--color-accent-hover, #D97706); }
    .popup-btn--danger {
      background: transparent;
      color: var(--color-destructive, #DC2626);
      border-color: var(--color-destructive, #DC2626);
      font-weight: 600;
    }
    .popup-btn--danger:hover { background: var(--color-destructive, #DC2626); color: #FFFFFF; }
    .popup-btn--ghost { background: transparent; }
  `;
  document.head.appendChild(style);
}

function ensureRoot() {
  injectStyles();
  if (rootEl && document.body.contains(rootEl)) return rootEl;
  rootEl = document.createElement('div');
  rootEl.id = 'popup-root';
  document.body.appendChild(rootEl);
  return rootEl;
}

function buildCard({ title, message, buttons }) {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  const card = document.createElement('div');
  card.className = 'popup-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  if (title) {
    const h = document.createElement('h3');
    h.className = 'popup-title';
    h.textContent = title;
    card.appendChild(h);
  }

  const body = document.createElement('p');
  body.className = 'popup-message';
  body.textContent = message;
  card.appendChild(body);

  const group = document.createElement('div');
  group.className = 'popup-actions';
  const btnEls = buttons.map(({ text, variant, onClick }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.className = 'popup-btn' + (variant ? ` popup-btn--${variant}` : '');
    btn.addEventListener('click', onClick);
    group.appendChild(btn);
    return btn;
  });
  card.appendChild(group);
  overlay.appendChild(card);

  return { overlay, btnEls };
}

export function showMessage(message, opts = {}) {
  const { title = '', okText = 'OK' } = opts;
  return new Promise(resolve => {
    const { overlay, btnEls } = buildCard({
      title,
      message: message == null ? '' : String(message),
      buttons: [{ text: okText, variant: 'primary', onClick: () => close(true) }]
    });
    ensureRoot().appendChild(overlay);
    if (btnEls[0]) btnEls[0].focus();

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(true); }
    }
    document.addEventListener('keydown', onKey);
  });
}

export function showConfirm(message, opts = {}) {
  const { title = '', okText = 'OK', cancelText = 'Cancel', danger = false } = opts;
  return new Promise(resolve => {
    const { overlay, btnEls } = buildCard({
      title,
      message: message == null ? '' : String(message),
      buttons: [
        { text: cancelText, variant: 'ghost', onClick: () => close(false) },
        { text: okText, variant: danger ? 'danger' : 'primary', onClick: () => close(true) }
      ]
    });
    ensureRoot().appendChild(overlay);
    if (btnEls[1]) btnEls[1].focus();

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
    }
    document.addEventListener('keydown', onKey);
  });
}
