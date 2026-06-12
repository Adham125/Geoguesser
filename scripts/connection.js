// Shared socket helpers: promise-based emit-with-ack (+ timeout) and a
// disconnect/reconnect status banner. Each page creates its own socket and
// opts in. Additive — does not change any existing emit.

import { showToast } from './popup.js';

/**
 * Emit an event and await the server ack, rejecting if no ack arrives in time.
 * Server handlers must call the ack callback (last arg). Returns the ack value.
 * @param {Socket} socket
 * @param {string} event
 * @param {*} payload
 * @param {object} [opts]
 * @param {number} [opts.timeout=8000]
 */
export function emitWithAck(socket, event, payload, opts = {}) {
  const timeout = opts.timeout ?? 8000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, timeout);
    socket.emit(event, payload, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(ack);
    });
  });
}

/**
 * Show a thin fixed top banner when the socket drops, clear it on reconnect.
 * Safe to call once per page after the socket is created.
 * @param {Socket} socket
 */
export function attachConnectionBanner(socket) {
  let banner = null;
  const ensure = () => {
    if (banner && document.body.contains(banner)) return banner;
    banner = document.createElement('div');
    banner.id = 'connection-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.textContent = 'Reconnecting…';
    Object.assign(banner.style, {
      position: 'fixed', top: '0', left: '0', right: '0',
      zIndex: 'var(--z-toast, 1200)',
      background: 'var(--color-warning, #F5A623)', color: 'var(--color-on-warning, #1A1200)',
      font: '600 13px/1 var(--font-heading, sans-serif)',
      letterSpacing: '0.04em', textAlign: 'center', padding: '7px 12px',
      transform: 'translateY(-100%)', transition: 'transform .2s ease-out',
    });
    document.body.appendChild(banner);
    return banner;
  };
  const show = (text) => { const b = ensure(); b.textContent = text; requestAnimationFrame(() => { b.style.transform = 'translateY(0)'; }); };
  const hide = () => { if (banner) banner.style.transform = 'translateY(-100%)'; };

  socket.on('disconnect', (reason) => {
    // 'io client disconnect' = we navigated away on purpose; ignore.
    if (reason === 'io client disconnect') return;
    show('Connection lost — reconnecting…');
  });
  socket.on('connect_error', () => show("Can't reach the server — retrying…"));
  socket.io.on('reconnect', () => { hide(); showToast('Reconnected.', { type: 'success', duration: 2500 }); });
  socket.on('connect', () => hide());
}
