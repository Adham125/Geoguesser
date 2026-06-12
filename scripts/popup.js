// Modal-style UI replacements for window.alert / window.confirm, plus toasts.
// `showMessage` → OK-only dialog. `showConfirm` → OK/Cancel dialog.
// `showToast` → transient, non-blocking notification.
// Dialogs trap focus, restore it on close, and wire ARIA. Styles self-inject.

import { trapFocus } from './modal-behavior.js';

let stylesInjected = false;
let rootEl = null;
let toastRootEl = null;
let dialogSeq = 0;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #popup-root { position: fixed; inset: 0; pointer-events: none; z-index: var(--z-modal, 1100); }
    .popup-overlay {
      position: absolute; inset: 0;
      background: rgba(4, 8, 16, 0.66);
      backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
      animation: popup-fade 0.18s ease-out;
    }
    @keyframes popup-fade { from {opacity:0;} to {opacity:1;} }
    .popup-card {
      background: var(--color-surface, #0E1424);
      border: 1px solid var(--color-border-strong, rgba(255,255,255,0.16));
      border-radius: var(--radius-lg, 16px);
      box-shadow: var(--shadow-lg, 0 20px 48px rgba(0,0,0,0.55));
      padding: 24px;
      max-width: min(460px, 90vw);
      color: var(--color-fg, #E6EAF2);
      animation: popup-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popup-pop { from {transform:scale(0.94); opacity:0;} to {transform:scale(1); opacity:1;} }
    .popup-title {
      margin: 0 0 10px;
      font-family: var(--font-heading, inherit);
      font-size: 18px; font-weight: 700;
      color: var(--color-fg, #E6EAF2);
    }
    .popup-message {
      margin: 0 0 20px;
      font-family: var(--font-body, inherit);
      line-height: 1.5; font-size: 15px;
      color: var(--color-fg, #E6EAF2);
      white-space: pre-wrap;
    }
    .popup-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .popup-btn {
      appearance: none;
      border: 1px solid var(--color-border-strong, rgba(255,255,255,0.16));
      background: var(--color-surface-2, #131B30);
      color: var(--color-fg, #E6EAF2);
      padding: 8px 18px;
      border-radius: var(--radius-md, 10px);
      font-family: var(--font-heading, inherit);
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }
    .popup-btn:hover { background: var(--color-surface-3, #19233C); }
    .popup-btn:active { transform: scale(0.98); }
    .popup-btn:focus-visible { outline: 2px solid var(--color-ring, #60A5FA); outline-offset: 2px; }
    .popup-btn--primary {
      background: var(--color-primary, #3B82F6);
      color: var(--color-on-primary, #FFFFFF);
      border-color: transparent;
    }
    .popup-btn--primary:hover { background: var(--color-primary-hover, #2D6FE3); }
    .popup-btn--danger {
      background: transparent;
      color: var(--color-destructive, #EF4444);
      border-color: var(--color-destructive, #EF4444);
    }
    .popup-btn--danger:hover { background: var(--color-destructive, #EF4444); color: #fff; }
    .popup-btn--ghost { background: transparent; border-color: var(--color-border, rgba(255,255,255,0.08)); }

    #toast-root {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      z-index: var(--z-toast, 1200); display: flex; flex-direction: column; gap: 8px;
      pointer-events: none; width: min(92vw, 420px);
    }
    .toast {
      pointer-events: auto; display: flex; align-items: center; gap: 12px;
      background: var(--glass-bg, rgba(14,20,36,0.72));
      -webkit-backdrop-filter: blur(12px) saturate(1.3); backdrop-filter: blur(12px) saturate(1.3);
      border: 1px solid var(--color-border-strong, rgba(255,255,255,0.16));
      border-left: 3px solid var(--color-primary, #3B82F6);
      border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-lg, 0 20px 48px rgba(0,0,0,0.55));
      padding: 12px 16px; color: var(--color-fg, #E6EAF2);
      font-family: var(--font-body, inherit); font-size: 14px;
      animation: toast-in 0.22s ease-out;
    }
    .toast--success { border-left-color: var(--color-success, #22C55E); }
    .toast--error { border-left-color: var(--color-destructive, #EF4444); }
    .toast--warning { border-left-color: var(--color-warning, #F5A623); }
    .toast.is-leaving { animation: toast-out 0.22s ease-out forwards; }
    @keyframes toast-in { from {opacity:0; transform: translateY(-8px);} to {opacity:1; transform: translateY(0);} }
    @keyframes toast-out { to {opacity:0; transform: translateY(-8px);} }
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

function ensureToastRoot() {
  injectStyles();
  if (toastRootEl && document.body.contains(toastRootEl)) return toastRootEl;
  toastRootEl = document.createElement('div');
  toastRootEl.id = 'toast-root';
  toastRootEl.setAttribute('aria-live', 'polite');
  toastRootEl.setAttribute('aria-atomic', 'false');
  document.body.appendChild(toastRootEl);
  return toastRootEl;
}

function buildCard({ title, message, buttons }) {
  const id = ++dialogSeq;
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  const card = document.createElement('div');
  card.className = 'popup-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  if (title) {
    const h = document.createElement('h3');
    h.className = 'popup-title';
    h.id = `popup-title-${id}`;
    h.textContent = title;
    card.appendChild(h);
    card.setAttribute('aria-labelledby', h.id);
  }

  const body = document.createElement('p');
  body.className = 'popup-message';
  body.id = `popup-msg-${id}`;
  body.textContent = message;
  card.appendChild(body);
  card.setAttribute('aria-describedby', body.id);

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

  return { overlay, card, btnEls };
}

export function showMessage(message, opts = {}) {
  const { title = '', okText = 'OK' } = opts;
  return new Promise((resolve) => {
    const { overlay, card, btnEls } = buildCard({
      title,
      message: message == null ? '' : String(message),
      buttons: [{ text: okText, variant: 'primary', onClick: () => close(true) }],
    });
    ensureRoot().appendChild(overlay);
    const release = trapFocus(card, {
      initialFocus: btnEls[0],
      onEscape: () => close(true),
    });

    function close(result) {
      release();
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        close(true);
      }
    }
    document.addEventListener('keydown', onKey);
  });
}

export function showConfirm(message, opts = {}) {
  const { title = '', okText = 'OK', cancelText = 'Cancel', danger = false } = opts;
  return new Promise((resolve) => {
    const { overlay, card, btnEls } = buildCard({
      title,
      message: message == null ? '' : String(message),
      buttons: [
        { text: cancelText, variant: 'ghost', onClick: () => close(false) },
        { text: okText, variant: danger ? 'danger' : 'primary', onClick: () => close(true) },
      ],
    });
    ensureRoot().appendChild(overlay);
    const release = trapFocus(card, {
      initialFocus: danger ? btnEls[0] : btnEls[1],
      onEscape: () => close(false),
    });

    function close(result) {
      release();
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        close(false);
      }
    }
    document.addEventListener('keydown', onKey);
  });
}

/**
 * Transient, non-blocking notification.
 * @param {string} message
 * @param {object} [opts]
 * @param {'info'|'success'|'error'|'warning'} [opts.type='info']
 * @param {number} [opts.duration=4000] ms; 0 = sticky (manual dismiss on click)
 */
export function showToast(message, opts = {}) {
  const { type = 'info', duration = 4000 } = opts;
  const root = ensureToastRoot();
  const toast = document.createElement('div');
  toast.className = 'toast' + (type && type !== 'info' ? ` toast--${type}` : '');
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message == null ? '' : String(message);
  root.appendChild(toast);

  let timer = null;
  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  toast.addEventListener('click', dismiss);
  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, duration); });
  }
  return dismiss;
}
