// Spotify integration — collapsible floating widget injected on any page that
// loads this script.
//
// Architecture (popup-based to survive page navigation):
//   - This module is self-initialising: it fetches /api/spotify/config to get
//     the public Client ID. If the backend has no SPOTIFY_CLIENT_ID set the
//     widget never renders, so the rest of the site is unaffected.
//   - Auth uses the Authorization Code + PKCE flow. The code-for-token swap
//     is performed by pages/spotify-callback.html so the access/refresh
//     tokens land in localStorage under spotify_* keys.
//   - **Playback lives in a persistent popup window** (pages/spotify-player.html)
//     because the Web Playback SDK creates an audio element bound to the page
//     lifecycle — every navigation in the main tab would otherwise kill the
//     player. The popup hosts the SDK; this widget acts as a remote and a
//     library browser. They talk over BroadcastChannel('geoguesser-spotify').
//   - Spotify Premium is required for in-browser playback (an SDK constraint).
//   - All spotify_* localStorage keys are preserved by scripts/main.js (see
//     the explicit preservation block at the top of that file).

import { showToast } from './popup.js';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const STORAGE = {
  access: 'spotify_access_token',
  refresh: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  verifier: 'spotify_code_verifier',
  state: 'spotify_oauth_state',
  returnTo: 'spotify_return_to',
  volume: 'spotify_volume',
};

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const CHANNEL_NAME = 'geoguesser-spotify';
const POPUP_URL = '/pages/spotify-player.html';
const POPUP_NAME = 'GeoGuesserSpotifyPlayer';
// Popup is small, positioned in the bottom-right corner, and has the
// restrictive features that make browsers treat it as a "minimal popup
// window" — those auto-close with the opener (the behaviour we want).
// Position is computed in openPlayerPopup() because screen.* isn't
// available at module load.
const POPUP_W = 380;
const POPUP_H = 540;

const REDIRECT_URI = `${window.location.origin}/pages/spotify-callback.html`;

const state = {
  clientId: null,
  popupConnected: false,
  popupWindow: null,
  // Set true the first time we focus the popup for a play command. Stays
  // true for the popup's lifetime — focus is "sticky" for the document and
  // subsequent plays don't need it. Reset on popup close / reopen.
  popupActivated: false,
  deviceId: null,
  isPremium: null,
  playlists: [],
  current: null,
  volume: parseFloat(localStorage.getItem(STORAGE.volume) || '0.25'),
  isExpanded: false,
  view: 'library',
  activePlaylist: null,
  searchQuery: '',
  searchResults: null,
  searchTimer: null,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',
  contextUri: null,
  progressTicker: null,
  isScrubbing: false,
  isPaused: true,
};

// ---------- Icons ----------

const ICON_LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.7-1.6-6.1-2-10.1-1.1a.75.75 0 1 1-.3-1.5c4.4-1 8.2-.6 11.2 1.3.4.2.5.6.2 1Zm1.5-3.4a.94.94 0 0 1-1.3.3c-3.1-1.9-7.8-2.4-11.4-1.3a.94.94 0 1 1-.6-1.8c4.2-1.3 9.4-.7 13 1.5.4.3.5.9.3 1.3Zm.1-3.6c-3.7-2.2-9.8-2.4-13.3-1.3a1.13 1.13 0 1 1-.7-2.2c4-1.2 10.8-1 15 1.5.5.3.7 1 .4 1.5-.3.5-1 .7-1.4.5Z"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const ICON_PREV = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"/></svg>`;
const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>`;
const ICON_SHUFFLE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10.6 9.2 6.4 5H3v2h2.6l3.6 3.6 1.4-1.4ZM21 7V3l-5 4 5 4V8h-1.6L16 11.4l-1.4-1.4L17.6 7H21ZM5 17v2h3.4l2.2-2.2-1.4-1.4L8 17H5Zm14-4v-2l-3.4-3.4-1.4 1.4L17.4 13H16v2h5l-5 4v-2h-2l-1.4-1.4 4.2-4.2L17.6 15H19v-2Z"/></svg>`;
const ICON_REPEAT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>`;
const ICON_REPEAT_ONE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Zm-5-3v-4h-1l-2 1v1h2v2h1Z"/></svg>`;
const ICON_VOLUME = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/></svg>`;
const ICON_EXTERNAL = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"/></svg>`;

let root, pill, panel, channel;

// ---------- BroadcastChannel IPC ----------

function initChannel() {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', onChannelMessage);
}

function send(msg) {
  if (channel) channel.postMessage(msg);
}

function onChannelMessage(e) {
  const msg = e.data;
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'pong':
    case 'ready':
      state.popupConnected = true;
      state.deviceId = msg.deviceId || state.deviceId;
      if (typeof msg.isPremium === 'boolean') state.isPremium = msg.isPremium;
      // Push the widget's stored volume so the popup matches the user's
      // preference instead of its own hardcoded default. Harmless if equal.
      send({ type: 'volume', value: state.volume });
      if (state.isExpanded) renderConnectionState();
      break;
    case 'state':
      applyRemoteState(msg);
      break;
    case 'premium-required':
      state.isPremium = false;
      if (state.isExpanded) renderConnectionState();
      break;
    case 'auth-required':
      // Popup says token expired and refresh failed — kick user to re-auth.
      clearTokens();
      state.popupConnected = false;
      state.deviceId = null;
      render();
      break;
    case 'closing':
      state.popupConnected = false;
      state.popupActivated = false;
      state.deviceId = null;
      state.current = null;
      stopProgressTicker();
      if (state.isExpanded) renderConnectionState();
      break;
  }
}

function applyRemoteState(msg) {
  const wasConnected = state.popupConnected;
  state.popupConnected = true; // receiving state means the popup is alive
  state.current = msg.current || null;
  state.position = msg.position || 0;
  state.duration = msg.duration || 0;
  state.shuffle = !!msg.shuffle;
  state.repeat = msg.repeat || 'off';
  state.isPaused = !msg.current || msg.current.paused;
  state.deviceId = msg.deviceId || state.deviceId;
  if (typeof msg.isPremium === 'boolean') state.isPremium = msg.isPremium;
  if (state.isPaused) stopProgressTicker(); else startProgressTicker();
  if (!wasConnected && state.isExpanded) renderConnectionState();
  paintPlaybackState();
}

// ---------- Popup management ----------

function openPlayerPopup() {
  // Must be in response to a user gesture (click handler) for popup blockers
  // to allow it. The named window means re-opens after a close reuse the slot.
  // Pin to the bottom-right corner with a 12px gap. screen.availWidth/Height
  // excludes the OS taskbar so the popup sits above it instead of behind it.
  const left = Math.max(0, screen.availWidth - POPUP_W - 12);
  const top = Math.max(0, screen.availHeight - POPUP_H - 12);
  const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},toolbar=no,menubar=no,location=no`;
  state.popupWindow = window.open(POPUP_URL, POPUP_NAME, features);
  if (!state.popupWindow) {
    showToast('Pop-up blocked — allow pop-ups for this site to open the music player.', { type: 'warning', duration: 6000 });
    return;
  }
  // Fresh popup → reset activation flag so the next play focuses it.
  state.popupActivated = false;
  // Race against the popup grabbing focus from the OS: try to refocus the
  // main tab multiple times. The popup also self-pushes via opener.focus()
  // from its own side, but browser focus timing is finicky enough that
  // both ends need to try repeatedly to reliably keep the popup behind.
  const refocusMain = () => { try { window.focus(); } catch {} };
  refocusMain();
  [50, 150, 350, 700, 1200].forEach((d) => setTimeout(refocusMain, d));
  if (state.isExpanded) renderConnectionState();
}

function focusPopup() {
  // Direct focus only works on the widget instance that opened the popup
  // (window.open returns a reference scoped to that page). After a main-tab
  // navigation, the new page has no reference even though the popup is
  // still alive — so we ask the popup to focus itself over BroadcastChannel.
  //
  // CRITICAL: never call window.open(url, name) here. With the popup's
  // named window already existing, window.open navigates it to `url` and
  // reloads the popup, stopping playback. The previous version did that.
  if (state.popupWindow && !state.popupWindow.closed) {
    try { state.popupWindow.focus(); return; } catch {}
  }
  send({ type: 'focus' });
}

async function pingForPopup() {
  // Returns true if we get a 'pong' or 'state' within the timeout.
  return new Promise((resolve) => {
    let done = false;
    const onMsg = (e) => {
      const t = e.data?.type;
      if (t === 'pong' || t === 'ready' || t === 'state') {
        if (done) return;
        done = true;
        channel.removeEventListener('message', onMsg);
        resolve(true);
      }
    };
    channel.addEventListener('message', onMsg);
    send({ type: 'ping' });
    setTimeout(() => {
      if (done) return;
      done = true;
      channel.removeEventListener('message', onMsg);
      resolve(false);
    }, 600);
  });
}

// ---------- DOM build ----------

function buildDOM() {
  root = document.createElement('div');
  root.id = 'spotify-widget';
  root.className = 'sp-root';
  root.setAttribute('data-state', 'collapsed');
  root.innerHTML = `
    <button type="button" class="sp-pill" aria-label="Open Spotify player" aria-expanded="false">
      <span class="sp-pill-icon">${ICON_LOGO}</span>
      <span class="sp-pill-label">Music</span>
      <span class="sp-pill-now" hidden>
        <span class="sp-pill-now-title">—</span>
        <button type="button" class="sp-pill-toggle" aria-label="Play/pause">${ICON_PLAY}</button>
      </span>
    </button>
    <section class="sp-panel" role="dialog" aria-label="Spotify player" hidden>
      <header class="sp-header">
        <span class="sp-header-logo">${ICON_LOGO}</span>
        <span class="sp-header-title">Spotify</span>
        <button type="button" class="sp-close" aria-label="Close player">${ICON_CLOSE}</button>
      </header>
      <div class="sp-body" data-view="loading">
        <div class="sp-loading">Loading…</div>
      </div>
    </section>
  `;
  document.body.appendChild(root);
  pill = root.querySelector('.sp-pill');
  panel = root.querySelector('.sp-panel');
  panel.tabIndex = -1;

  pill.addEventListener('click', toggleExpanded);
  const pillToggleBtn = pill.querySelector('.sp-pill-toggle');
  if (pillToggleBtn) pillToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); send({ type: 'toggle' }); });
  root.querySelector('.sp-close').addEventListener('click', () => setExpanded(false));

  // Use mousedown (not click) for the outside-close check. Inside-click
  // handlers like openPlaylist replace pane.innerHTML, which detaches the
  // event target before the document-level click handler runs — so
  // root.contains(target) returns false and the panel would close. mousedown
  // fires before any of those handlers can mutate the DOM.
  document.addEventListener('mousedown', (e) => {
    if (!state.isExpanded) return;
    if (root.contains(e.target)) return;
    setExpanded(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isExpanded) setExpanded(false);
  });
}

function setExpanded(open) {
  state.isExpanded = open;
  root.setAttribute('data-state', open ? 'expanded' : 'collapsed');
  pill.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.hidden = !open;
  if (open) {
    render();
    // Ask the popup for a fresh state snapshot when we come back to the UI.
    if (state.popupConnected) send({ type: 'state-request' });
    requestAnimationFrame(() => {
      const focusTarget = panel.querySelector('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
      try { (focusTarget || panel).focus(); } catch {}
    });
  } else {
    try { pill.focus(); } catch {}
  }
}

function toggleExpanded() { setExpanded(!state.isExpanded); }

// ---------- Render ----------

function render() {
  const body = panel.querySelector('.sp-body');
  if (!getAccessToken()) {
    body.dataset.view = 'login';
    body.innerHTML = `
      <div class="sp-login">
        <div class="sp-login-logo">${ICON_LOGO}</div>
        <h3 class="sp-login-title">Listen while you guess</h3>
        <p class="sp-login-blurb">Connect your Spotify account to play music inside the game. Spotify Premium is required for in-browser playback.</p>
        <button type="button" class="sp-cta sp-cta--primary" id="sp-login-btn">Connect Spotify</button>
      </div>
    `;
    body.querySelector('#sp-login-btn').addEventListener('click', beginLogin);
    return;
  }

  body.dataset.view = 'player';
  body.innerHTML = `
    <div class="sp-connection" id="sp-connection"></div>

    <div class="sp-now">
      <div class="sp-art" id="sp-art"></div>
      <div class="sp-meta">
        <div class="sp-track" id="sp-track">—</div>
        <div class="sp-artist" id="sp-artist"></div>
        <div class="sp-status" id="sp-status">—</div>
      </div>
    </div>

    <div class="sp-progress-row">
      <span class="sp-time" id="sp-time-cur">0:00</span>
      <input type="range" class="sp-progress" id="sp-progress" min="0" max="0" value="0" step="1000" aria-label="Track position" disabled>
      <span class="sp-time" id="sp-time-tot">0:00</span>
    </div>

    <div class="sp-controls">
      <button type="button" class="sp-ctl-icon" id="sp-shuffle" aria-label="Toggle shuffle" aria-pressed="false">${ICON_SHUFFLE}</button>
      <button type="button" class="sp-ctl" id="sp-prev" aria-label="Previous track">${ICON_PREV}</button>
      <button type="button" class="sp-ctl sp-ctl--main" id="sp-toggle" aria-label="Play / pause">${ICON_PLAY}</button>
      <button type="button" class="sp-ctl" id="sp-next" aria-label="Next track">${ICON_NEXT}</button>
      <button type="button" class="sp-ctl-icon" id="sp-repeat" aria-label="Cycle repeat" data-mode="off">${ICON_REPEAT}</button>
    </div>

    <div class="sp-vol-row">
      <span class="sp-vol-icon" aria-hidden="true">${ICON_VOLUME}</span>
      <input type="range" min="0" max="100" value="${Math.round(state.volume * 100)}" class="sp-vol" id="sp-vol" aria-label="Volume">
    </div>

    <div class="sp-search-row">
      <span class="sp-search-icon" aria-hidden="true">${ICON_SEARCH}</span>
      <input type="search" class="sp-search-input" id="sp-search" placeholder="Search songs or playlists" autocomplete="off" value="${escapeAttr(state.searchQuery)}">
      <button type="button" class="sp-search-clear" id="sp-search-clear" aria-label="Clear search" ${state.searchQuery ? '' : 'hidden'}>${ICON_CLOSE}</button>
    </div>

    <div class="sp-listpane" id="sp-listpane"></div>

    <button type="button" class="sp-logout" id="sp-logout">Disconnect Spotify</button>
  `;

  wireControls();
  renderConnectionState();
  paintPlaybackState();
  renderListPane();
  if (!state.playlists.length) loadPlaylists();
}

function renderConnectionState() {
  const banner = panel?.querySelector('#sp-connection');
  if (!banner) return;
  const setControlsEnabled = (on) => {
    panel.querySelectorAll('.sp-ctl, .sp-ctl-icon, .sp-progress').forEach((el) => { el.disabled = !on; });
  };

  if (state.isPremium === false) {
    banner.innerHTML = `
      <div class="sp-banner sp-banner--warn">
        <strong>Spotify Premium required</strong> for in-browser playback. You can still browse your library here, but playback won't start.
      </div>
    `;
    setControlsEnabled(false);
    return;
  }

  if (!state.popupConnected) {
    banner.innerHTML = `
      <div class="sp-banner sp-banner--cta">
        <div class="sp-banner-text">
          <strong>Open the player window to start music.</strong><br>
          <span class="sp-banner-sub">Keep it open while you play — music continues across page changes.</span>
        </div>
        <button type="button" class="sp-banner-btn" id="sp-open-player">${ICON_EXTERNAL}<span>Open Player</span></button>
      </div>
    `;
    panel.querySelector('#sp-open-player').addEventListener('click', openPlayerPopup);
    setControlsEnabled(false);
    return;
  }

  // Connected — clear the banner and enable controls.
  banner.innerHTML = `
    <div class="sp-banner sp-banner--ok">
      <span class="sp-banner-dot" aria-hidden="true"></span>
      <span class="sp-banner-text">Player window connected</span>
      <button type="button" class="sp-banner-link" id="sp-focus-player">Focus</button>
    </div>
  `;
  panel.querySelector('#sp-focus-player').addEventListener('click', focusPopup);
  setControlsEnabled(true);
  // The play button stays usable; the rest enable based on whether something
  // is loaded. (Empty state will keep prev/next disabled by Spotify itself.)
}

function wireControls() {
  panel.querySelector('#sp-prev').addEventListener('click', () => send({ type: 'prev' }));
  panel.querySelector('#sp-next').addEventListener('click', () => send({ type: 'next' }));
  panel.querySelector('#sp-toggle').addEventListener('click', () => send({ type: 'toggle' }));
  panel.querySelector('#sp-shuffle').addEventListener('click', toggleShuffle);
  panel.querySelector('#sp-repeat').addEventListener('click', cycleRepeat);

  const vol = panel.querySelector('#sp-vol');
  vol.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10) / 100;
    state.volume = v;
    localStorage.setItem(STORAGE.volume, String(v));
    send({ type: 'volume', value: v });
  });

  const progress = panel.querySelector('#sp-progress');
  progress.addEventListener('input', () => {
    state.isScrubbing = true;
    paintProgressLabel(parseInt(progress.value, 10));
  });
  progress.addEventListener('change', () => {
    const ms = parseInt(progress.value, 10);
    state.isScrubbing = false;
    send({ type: 'seek', position: ms });
    state.position = ms;
  });

  const search = panel.querySelector('#sp-search');
  search.addEventListener('input', (e) => {
    const q = e.target.value;
    state.searchQuery = q;
    panel.querySelector('#sp-search-clear').hidden = !q;
    clearTimeout(state.searchTimer);
    if (!q.trim()) {
      state.searchResults = null;
      renderListPane();
      return;
    }
    state.searchTimer = setTimeout(() => runSearch(q.trim()), 280);
  });
  panel.querySelector('#sp-search-clear').addEventListener('click', () => {
    state.searchQuery = '';
    state.searchResults = null;
    const inp = panel.querySelector('#sp-search');
    inp.value = '';
    inp.focus();
    panel.querySelector('#sp-search-clear').hidden = true;
    renderListPane();
  });

  panel.querySelector('#sp-logout').addEventListener('click', logout);
}

// ---------- List pane ----------

function renderListPane() {
  const pane = panel?.querySelector('#sp-listpane');
  if (!pane) return;

  if (state.view === 'playlist-tracks' && state.activePlaylist) {
    renderPlaylistTracks(pane);
    return;
  }
  if (state.searchQuery.trim()) {
    renderSearchResults(pane);
    return;
  }
  pane.innerHTML = `
    <div class="sp-section-title">Your playlists</div>
    <ul class="sp-list sp-playlists" id="sp-playlists">
      ${state.playlists.length
        ? state.playlists.map(playlistItemHTML).join('')
        : `<li class="sp-pl-loading">Loading playlists…</li>`}
    </ul>
  `;
  wirePlaylistItems(pane);
}

function renderSearchResults(pane) {
  const r = state.searchResults;
  if (!r) {
    pane.innerHTML = `<div class="sp-pl-loading">Searching…</div>`;
    return;
  }
  const tracks = (r.tracks || []).filter(Boolean);
  const playlists = (r.playlists || []).filter(Boolean);
  if (!tracks.length && !playlists.length) {
    pane.innerHTML = `<div class="sp-pl-empty">No results for "${escapeHTML(state.searchQuery)}".</div>`;
    return;
  }
  pane.innerHTML = `
    ${tracks.length ? `
      <div class="sp-section-title">Songs</div>
      <ul class="sp-list sp-tracks" data-source="search">
        ${tracks.map(trackItemHTML).join('')}
      </ul>
    ` : ''}
    ${playlists.length ? `
      <div class="sp-section-title">Playlists</div>
      <ul class="sp-list sp-playlists">
        ${playlists.map(playlistItemHTML).join('')}
      </ul>
    ` : ''}
  `;
  wireTrackItems(pane);
  wirePlaylistItems(pane);
}

function renderPlaylistTracks(pane) {
  const pl = state.activePlaylist;
  pane.innerHTML = `
    <div class="sp-drill-header">
      <button type="button" class="sp-back" id="sp-back" aria-label="Back to playlists">${ICON_BACK}<span>Playlists</span></button>
      <button type="button" class="sp-play-all" id="sp-shuffle-pl">${ICON_SHUFFLE}<span>Shuffle</span></button>
    </div>
    <div class="sp-drill-title" title="${escapeAttr(pl.name)}">${escapeHTML(pl.name)}</div>
    <ul class="sp-list sp-tracks" data-source="playlist" data-context="${escapeAttr(pl.uri)}">
      ${pl.tracks
        ? pl.tracks.map(trackItemHTML).join('')
        : `<li class="sp-pl-loading">Loading tracks…</li>`}
    </ul>
  `;
  pane.querySelector('#sp-back').addEventListener('click', backToLibrary);
  pane.querySelector('#sp-shuffle-pl').addEventListener('click', () => {
    state.contextUri = pl.uri;
    shufflePlaylist(pl.uri);
  });
  if (pl.tracks) wireTrackItems(pane);
}

function playlistItemHTML(p) {
  if (!p) return '';
  const art = p.images?.[0]?.url;
  return `
    <li class="sp-pl" data-uri="${escapeAttr(p.uri)}" data-id="${escapeAttr(p.id)}" data-name="${escapeAttr(p.name)}" tabindex="0" role="button" aria-label="Open ${escapeAttr(p.name)}">
      <span class="sp-pl-art" style="${art ? `background-image:url('${escapeAttr(art)}')` : ''}"></span>
      <span class="sp-pl-name">${escapeHTML(p.name)}</span>
      <span class="sp-pl-count">${p.tracks?.total ?? ''}</span>
    </li>
  `;
}

function trackItemHTML(t) {
  if (!t) return '';
  const art = t.album?.images?.[0]?.url;
  const artists = (t.artists || []).map(a => a.name).join(', ');
  return `
    <li class="sp-track-item" data-uri="${escapeAttr(t.uri)}" tabindex="0" role="button" aria-label="Play ${escapeAttr(t.name)}">
      <span class="sp-tk-art" style="${art ? `background-image:url('${escapeAttr(art)}')` : ''}"></span>
      <span class="sp-tk-text">
        <span class="sp-tk-name">${escapeHTML(t.name)}</span>
        <span class="sp-tk-artist">${escapeHTML(artists)}</span>
      </span>
      <span class="sp-tk-dur">${formatMs(t.duration_ms || 0)}</span>
    </li>
  `;
}

function wirePlaylistItems(pane) {
  pane.querySelectorAll('.sp-pl').forEach((el) => {
    const open = () => openPlaylist({ id: el.dataset.id, uri: el.dataset.uri, name: el.dataset.name });
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

function wireTrackItems(pane) {
  pane.querySelectorAll('.sp-track-item').forEach((el) => {
    const listEl = el.closest('.sp-tracks');
    const ctx = listEl?.dataset.context || null;
    const play = () => playTrack(el.dataset.uri, ctx);
    el.addEventListener('click', play);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  });
}

// ---------- Now-playing paint ----------

function paintPlaybackState() {
  if (!root) return;
  const playing = state.current && !state.current.paused;
  const track = state.current?.track_window?.current_track;

  const pillNow = pill.querySelector('.sp-pill-now');
  const pillTitle = pill.querySelector('.sp-pill-now-title');
  const pillToggle = pill.querySelector('.sp-pill-toggle');
  if (track) {
    pillNow.hidden = false;
    pillTitle.textContent = `${track.name} — ${track.artists?.[0]?.name || ''}`;
    pillToggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  } else {
    pillNow.hidden = true;
  }

  if (!state.isExpanded) return;

  const art = panel.querySelector('#sp-art');
  if (!art) return;
  const trackEl = panel.querySelector('#sp-track');
  const artistEl = panel.querySelector('#sp-artist');
  const statusEl = panel.querySelector('#sp-status');
  const toggleBtn = panel.querySelector('#sp-toggle');
  const progress = panel.querySelector('#sp-progress');
  const shuffleBtn = panel.querySelector('#sp-shuffle');
  const repeatBtn = panel.querySelector('#sp-repeat');

  if (track) {
    const url = track.album?.images?.[0]?.url;
    art.style.backgroundImage = url ? `url("${url}")` : '';
    trackEl.textContent = track.name;
    artistEl.textContent = (track.artists || []).map(a => a.name).join(', ');
    statusEl.textContent = playing ? 'Now playing' : 'Paused';
    toggleBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    progress.max = String(state.duration || 0);
    if (!state.isScrubbing) progress.value = String(state.position || 0);
    paintProgressLabel(state.position || 0);
  } else if (state.popupConnected) {
    trackEl.textContent = '—';
    artistEl.textContent = '';
    statusEl.textContent = state.isPremium === false
      ? 'Spotify Premium required'
      : 'Pick a playlist or search for a song';
    toggleBtn.innerHTML = ICON_PLAY;
  } else {
    trackEl.textContent = '—';
    artistEl.textContent = '';
    statusEl.textContent = 'Open the player window to start';
    toggleBtn.innerHTML = ICON_PLAY;
  }

  shuffleBtn.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false');
  repeatBtn.dataset.mode = state.repeat;
  repeatBtn.innerHTML = state.repeat === 'track' ? ICON_REPEAT_ONE : ICON_REPEAT;
}

function paintProgressLabel(positionMs) {
  const cur = panel?.querySelector('#sp-time-cur');
  const tot = panel?.querySelector('#sp-time-tot');
  if (cur) cur.textContent = formatMs(positionMs);
  if (tot) tot.textContent = formatMs(state.duration || 0);
}

function startProgressTicker() {
  stopProgressTicker();
  state.progressTicker = setInterval(() => {
    if (state.isPaused || state.isScrubbing) return;
    state.position = Math.min(state.position + 500, state.duration || state.position + 500);
    if (state.isExpanded) {
      const progress = panel.querySelector('#sp-progress');
      if (progress) progress.value = String(state.position);
      paintProgressLabel(state.position);
    }
  }, 500);
}
function stopProgressTicker() {
  if (state.progressTicker) clearInterval(state.progressTicker);
  state.progressTicker = null;
}

function setStatus(msg) {
  const el = panel?.querySelector('#sp-status');
  if (el) el.textContent = msg;
}

// ---------- Storage helpers ----------

function getAccessToken() {
  const t = localStorage.getItem(STORAGE.access);
  const exp = parseInt(localStorage.getItem(STORAGE.expiresAt) || '0', 10);
  if (!t || !exp) return null;
  return t;
}
function tokensFresh() {
  const exp = parseInt(localStorage.getItem(STORAGE.expiresAt) || '0', 10);
  return Date.now() < exp - 30_000;
}
function clearTokens() {
  [STORAGE.access, STORAGE.refresh, STORAGE.expiresAt, STORAGE.verifier, STORAGE.state, STORAGE.returnTo]
    .forEach(k => localStorage.removeItem(k));
}

// ---------- PKCE ----------

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function beginLogin() {
  if (!state.clientId) return;
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const csrfState = randomString(24);
  localStorage.setItem(STORAGE.verifier, verifier);
  localStorage.setItem(STORAGE.state, csrfState);
  localStorage.setItem(STORAGE.returnTo, window.location.href);

  const params = new URLSearchParams({
    client_id: state.clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: csrfState,
    scope: SCOPES,
  });
  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem(STORAGE.refresh);
  if (!refresh || !state.clientId) return false;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: state.clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  localStorage.setItem(STORAGE.access, data.access_token);
  localStorage.setItem(STORAGE.expiresAt, String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) localStorage.setItem(STORAGE.refresh, data.refresh_token);
  return true;
}

function logout() {
  // Close the popup if we can — it'll broadcast 'closing' on unload, which
  // updates the widget state. If we can't reach it, the popup will simply
  // sit there with no tokens until the user closes it manually.
  try {
    if (state.popupWindow && !state.popupWindow.closed) state.popupWindow.close();
  } catch {}
  state.popupConnected = false;
  state.popupActivated = false;
  state.deviceId = null;
  state.popupWindow = null;
  state.current = null;
  state.isPremium = null;
  state.playlists = [];
  state.searchQuery = '';
  state.searchResults = null;
  state.view = 'library';
  state.activePlaylist = null;
  stopProgressTicker();
  clearTokens();
  paintPlaybackState();
  render();
}

// ---------- API ----------

async function api(path, init = {}) {
  if (!tokensFresh()) {
    const ok = await refreshAccessToken();
    if (!ok) { render(); return null; }
  }
  const token = getAccessToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Authorization': `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (!ok) { render(); return null; }
    return api(path, init);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    console.warn('[spotify] api error', res.status, path);
    setStatus('Spotify request failed — try again.');
    return null;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

// ---------- Library / playlists / search ----------

async function loadPlaylists() {
  const data = await api('/me/playlists?limit=50');
  if (!data?.items) return;
  state.playlists = data.items.filter(Boolean);
  if (state.view === 'library' && !state.searchQuery.trim()) renderListPane();
}

async function openPlaylist({ id, uri, name }) {
  state.view = 'playlist-tracks';
  state.activePlaylist = { id, uri, name, tracks: null };
  renderListPane();
  const data = await api(`/playlists/${encodeURIComponent(id)}/tracks?limit=100&fields=items(track(name,uri,duration_ms,album(images),artists(name)))`);
  const tracks = (data?.items || []).map((it) => it?.track).filter(t => t && t.uri);
  state.activePlaylist.tracks = tracks;
  if (state.view === 'playlist-tracks' && state.activePlaylist?.id === id) renderListPane();
}

function backToLibrary() {
  state.view = 'library';
  state.activePlaylist = null;
  renderListPane();
}

async function runSearch(query) {
  state.searchResults = null;
  renderListPane();
  const params = new URLSearchParams({ q: query, type: 'track,playlist', limit: '8' });
  const data = await api(`/search?${params.toString()}`);
  if (state.searchQuery.trim() !== query) return;
  state.searchResults = {
    tracks: data?.tracks?.items || [],
    playlists: data?.playlists?.items || [],
  };
  renderListPane();
}

// ---------- Playback actions ----------

async function ensureActiveDevice() {
  if (!state.popupConnected || !state.deviceId) {
    setStatus('Open the player window first.');
    if (state.isExpanded) renderConnectionState();
    return false;
  }
  if (state.isPremium === false) {
    setStatus('Spotify Premium required for in-browser playback.');
    return false;
  }
  // First play of this popup session — focus the popup so it has the user
  // activation needed for the SDK's audio element to actually emit sound.
  // Browser autoplay policies block the audio otherwise; the play command
  // succeeds server-side (timer advances) but stays silent until focus.
  if (!state.popupActivated && state.popupWindow && !state.popupWindow.closed) {
    try { state.popupWindow.focus(); } catch {}
    state.popupActivated = true;
  }
  // Make sure Spotify is sending playback to OUR device (in case the user has
  // multiple SDK devices floating around).
  await api('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [state.deviceId], play: false }),
  });
  return true;
}

async function playContext(contextUri) {
  if (!(await ensureActiveDevice())) return;
  await api(`/me/player/play?device_id=${encodeURIComponent(state.deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: contextUri }),
  });
}

// Turn shuffle on, then start the playlist context. Spotify picks the first
// track at random when shuffle is enabled at play time. Sets state.shuffle
// optimistically so the shuffle icon flips immediately.
async function shufflePlaylist(contextUri) {
  if (!(await ensureActiveDevice())) return;
  state.shuffle = true;
  paintPlaybackState();
  await api(`/me/player/shuffle?state=true&device_id=${encodeURIComponent(state.deviceId)}`, { method: 'PUT' });
  await api(`/me/player/play?device_id=${encodeURIComponent(state.deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: contextUri }),
  });
}

async function playTrack(trackUri, contextUri = null) {
  if (!(await ensureActiveDevice())) return;
  const body = contextUri
    ? { context_uri: contextUri, offset: { uri: trackUri } }
    : { uris: [trackUri] };
  await api(`/me/player/play?device_id=${encodeURIComponent(state.deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function toggleShuffle() {
  if (!state.deviceId) return;
  const next = !state.shuffle;
  state.shuffle = next;
  paintPlaybackState();
  await api(`/me/player/shuffle?state=${next}&device_id=${encodeURIComponent(state.deviceId)}`, {
    method: 'PUT',
  });
}

async function cycleRepeat() {
  if (!state.deviceId) return;
  const next = state.repeat === 'off' ? 'context' : state.repeat === 'context' ? 'track' : 'off';
  state.repeat = next;
  paintPlaybackState();
  await api(`/me/player/repeat?state=${next}&device_id=${encodeURIComponent(state.deviceId)}`, {
    method: 'PUT',
  });
}

// ---------- Utils ----------

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHTML(s).replace(/"/g, '&quot;'); }
function formatMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// ---------- Cross-tab token updates ----------
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE.access && e.newValue && !state.popupConnected) {
    render();
    // Don't auto-open popup here — it would be blocked. The user clicks
    // "Open Player" from the expanded panel.
  }
});

// ---------- Boot ----------

async function boot() {
  let config;
  try {
    const r = await fetch('/api/spotify/config', { credentials: 'same-origin' });
    if (!r.ok) return;
    config = await r.json();
  } catch {
    return;
  }
  if (!config.enabled) return;
  state.clientId = config.clientId;

  buildDOM();
  initChannel();

  if (getAccessToken()) {
    // See if a popup is already running (e.g. user navigated to a new page).
    const alive = await pingForPopup();
    if (alive) state.popupConnected = true;
  }
  paintPlaybackState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
