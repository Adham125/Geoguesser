import { serverURL as server } from './config.js';
import { showMessage, showConfirm } from './popup.js';

// =====================================================================
// Hide & Seek — two-phase multiplayer client.
//
// Phase flow (server-authoritative):
//   HIDE → (server detects all locked / host presses Start) → SEEK
//   SEEK round N → REVEAL → advance → next round or FINAL.
//
// This client never computes scores or chooses the owner for a round.
// It only expresses intent (lock spot / submit guess / broadcast pose)
// and reflects server state.
// =====================================================================

// ---- DOM handles ----
const mapcss             = document.getElementById("map");
const panocss            = document.getElementById("pano");
const loadingSpinner     = document.getElementById("loading-spinner");
const compassEl          = document.getElementById("compass");
const compassImage       = document.getElementById("compass-image");
const timer              = document.getElementById("timer");
const phaseBanner        = document.getElementById("phase-banner");
const phaseLabel         = phaseBanner.querySelector(".phase-label");
const phaseSub           = phaseBanner.querySelector(".phase-sub");
const rosterPanel        = document.getElementById("roster-panel");
const rosterList         = document.getElementById("roster-list");
const rosterTitle        = rosterPanel.querySelector(".hs-panel-title");
const endGameButton      = document.getElementById("endGameButton");
const lockSpotButton     = document.getElementById("lockSpotButton");
const unlockSpotButton   = document.getElementById("unlockSpotButton");
const guessButton        = document.getElementById("guessButton");
const hsReturnToStartButton = document.getElementById("hsReturnToStartButton");
// Legacy floating spectator panel — hidden after the hider-tabs rework.
const spectatorToggle    = document.getElementById("spectator-toggle");
const spectatorPanel     = document.getElementById("spectator-panel");
const guessPicker        = document.getElementById("guess-picker");
const guessPickerList    = document.getElementById("guess-picker-list");
const guessPickerCancel  = document.getElementById("guess-picker-cancel");

// Top tab strip — only used while the current player is the hider.
const hiderTabs          = document.getElementById("hider-tabs");
const hiderTabsList      = document.getElementById("hider-tabs-list");

const countdownOverlay  = document.getElementById("hs-countdown");
const countdownNumber   = document.getElementById("hs-countdown-number");

const revealOverlay      = document.getElementById("reveal-overlay");
const revealRoundNum     = document.getElementById("reveal-round-num");
const revealOwnerName    = document.getElementById("reveal-owner-name");
const revealGuesses      = document.getElementById("reveal-guesses");
const revealCountdown    = document.getElementById("reveal-countdown");
const revealNextButton   = document.getElementById("revealNextButton");
const scoresMenu         = document.getElementById("scoresMenu");
const scoresList         = document.getElementById("scoresList");
const scoresWinner       = document.getElementById("scoresWinner");

// ---- Session state ----
const roomName     = JSON.parse(localStorage.getItem("roomCode"));
// `hosting` is mutable — server-side host may be reassigned if the original
// host leaves, and the UI must react live. Start from the localStorage hint
// and let `hostChanged` events update it.
let hosting        = JSON.parse(localStorage.getItem("roomHost"));
let currentHostId  = null;
const playerName   = localStorage.getItem("playerName");
const playerColour = localStorage.getItem("playerColour");

// ---- Client state machine ----
let phase = "hide";                 // hide | seek | reveal | final
let roomPlayers = {};               // { sid: { name, colour } } — kept in sync from hsRoster / hsRoundStart
let readySet = new Set();           // who's locked in, during HIDE
let myHidingSpot = null;            // { panoId, lat, lng, heading, pitch } after we lock
let myHidingSpotMarker = null;      // visual confirmation pin dropped on the hide-phase map
// H&S rule from lobby options[8]; seeded from localStorage.gameOptions so the
// pegman source filter is applied before the first roomOptionsUpdate arrives,
// then authoritatively overwritten by the socket event.
let hsAllowPhotospheres = (() => {
  try {
    const raw = localStorage.getItem("gameOptions");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.hsAllowPhotospheres);
  } catch (_) { return false; }
})();

let map = null;                     // primary Google Map (fills screen during HIDE, corner during SEEK)
let mainStreetView = null;          // SV instance embedded in #map during HIDE (pegman), or in #pano during SEEK
let seekStreetView = null;          // SV in #pano during SEEK

let currentRoundIdx = -1;           // -1 before first round
let totalRounds = 0;
let displayRound = 0;               // 0-based outer round from server (for "Round X/Y")
let currentHiderIdx = 0;            // 0-based hider index within current round (for "Spot i/N")
let totalHidersThisRound = 0;       // hiders in the active round
let isOwnerThisRound = false;       // derived from hsRoundStart.ownerId === socket.id
let revealedOwnerId = null;         // only known once the round reveal arrives
let roundOwner = null;              // { id, name, colour } of the current sub-round's hider
let pendingRoundPanoId = null;      // stashed panoId to load after ownership is resolved
let pendingRoundPose = null;        // { heading, pitch } stashed until load
let roundTimerSec = 0;              // countdown remaining (server dictates duration; client ticks locally)
let countdownInterval = null;
let revealCountdownInterval = null;

// Spectator state.
let liveViews = {};                 // { seekerId: { panoId, heading, pitch, zoom } }
let spectatorTarget = null;         // seekerId currently displayed in spectator pano
let spectatorSVInstance = null;     // dedicated StreetViewPanorama for spectating
let spectatorSVAttached = false;    // whether we've wired listeners to prevent our own pose broadcasts

let liveViewLastEmit = 0;           // throttle timestamp
const LIVE_VIEW_THROTTLE_MS = 100;  // ~10 Hz; interpolation covers the gaps
// Track what we've already loaded into the spectator pano so we can skip
// redundant setPano calls — setPano triggers a full SV reload, which is
// what made the hider's spectator view feel choppy on every pose update.
let spectatorAppliedPanoId = null;

// Hider-side spectator smoothing: we receive seeker pose updates at ~10 Hz
// and tween toward them with RAF so the view feels continuous instead of
// snapping every 100ms. `Current` holds the pov we've applied to the SV;
// `Target` holds the latest network value.
let spectatorCurrentPov = null;
let spectatorTargetPov  = null;
let spectatorRafHandle  = null;

// ---- Guess / map state (SEEK phase) ----
let myGuessPosition = null;         // {lat, lng} once user has dropped a pin (not yet submitted)
let myGuessLocked  = false;         // true once confirm submitted to server
let myGuessMarker  = null;          // seeker's own pending marker
let seekMapClickListener = null;    // click listener registered on entering SEEK
let ownerFlagMarker = null;         // flag drawn on hider's map at their own spot
let roundMarkers   = [];            // all markers drawn during a round (clear between rounds)
let roundPolylines = [];            // polylines drawn at reveal

// ---- Socket ----
const socket = io(server, { withCredentials: true });

socket.emit("loadAPIKeyMaps", (callback) => {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${callback.key}&libraries=marker&callback=hsInit&v=weekly`;
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
});

socket.emit("joinedGame", [roomName, playerName, playerColour]);

// Room settings snapshot (sent from server on joinedGame + on each lobby
// update). Index 8 is the H&S "allow photospheres" toggle — we enforce it
// client-side on both the pegman resolution and the Lock In button.
socket.on("roomOptionsUpdate", (options) => {
  if (!Array.isArray(options)) return;
  hsAllowPhotospheres = !!options[8];
  applyHideMapPhotosphereFilter();
});

// Roster seeds from classic's playerJoined event.
socket.on("playerJoined", (players) => {
  roomPlayers = players;
  renderRoster();
});

socket.on("playerLeft", ({ players }) => {
  if (players) roomPlayers = players;
  renderRoster();
});

socket.on("hostChanged", ({ hostId }) => {
  currentHostId = hostId;
  hosting = hostId === socket.id;
  localStorage.setItem("roomHost", hosting ? "true" : "false");
  // End Game button visibility flips with host status.
  if (endGameButton) {
    if (hosting) endGameButton.classList.remove("hidden");
    else endGameButton.classList.add("hidden");
  }
  // Roster re-render updates the HOST badge and the Start Seek button.
  renderRoster();
});

socket.on("kicked", async ({ reason } = {}) => {
  await showMessage(reason || "You were removed from the room by the host.", {
    title: "Removed from room"
  });
  window.location.href = './main.html';
});

socket.on("hsRoster", ({ players, ready, phase: serverPhase }) => {
  if (players) roomPlayers = players;
  if (Array.isArray(ready)) readySet = new Set(ready);
  if (serverPhase) phase = serverPhase;
  renderRoster();
});

socket.on("hsPhaseChange", ({ phase: newPhase }) => {
  // Countdown always ends just before the seek phase begins — hide the
  // overlay explicitly so a late-arriving tick can't leave it stuck.
  if (countdownOverlay) countdownOverlay.classList.add("hidden");
  if (newPhase === "seek") enterSeekPhase();
  else if (newPhase === "hide") enterHidePhase();
});

// Hide → Seek countdown ticks (3, 2, 1, 0 → "GO!"). `cancelled` fires if a
// player unlocks or leaves in the middle of the countdown.
socket.on("hsCountdown", ({ secondsLeft, cancelled }) => {
  if (!countdownOverlay || !countdownNumber) return;
  if (cancelled || secondsLeft == null) {
    countdownOverlay.classList.add("hidden");
    return;
  }
  countdownOverlay.classList.remove("hidden");
  countdownNumber.textContent = secondsLeft <= 0 ? "GO!" : String(secondsLeft);
  // Restart the pulse animation on each tick so the value change is visible.
  countdownNumber.style.animation = "none";
  void countdownNumber.offsetWidth;  // force reflow
  countdownNumber.style.animation = "";
});

socket.on("hsRoundStart", (data) => {
  if (data.players) roomPlayers = data.players;
  startSeekRound(data);
});

socket.on("hsLiveViewUpdate", ({ seekerId, panoId, heading, pitch, zoom }) => {
  liveViews[seekerId] = { panoId, heading, pitch, zoom };
  // Only the hider renders the spectator stream on the main #pano. When the
  // first live-view arrives, auto-select it so they see *something*.
  if (isOwnerThisRound) {
    if (!spectatorTarget && seekerId !== socket.id) {
      spectatorTarget = seekerId;
      renderHiderTabs();
    }
    if (seekerId === spectatorTarget) applySpectatorToMainPano();
  }
});

socket.on("hsGuessLocked", ({ seekerId }) => {
  markGuessLocked(seekerId);
});

// Targeted emit to the round's hider — includes the seeker's pin position
// so the hider can watch the guesses roll in. Seekers never receive this.
socket.on("hsGuessToOwner", ({ seekerId, position, colour }) => {
  if (!isOwnerThisRound || !map || !position) return;
  addRoundMarker(position, colour || "#888");
});

socket.on("hsRoundReveal", (payload) => {
  showReveal(payload);
});

socket.on("hsGameOver", (payload) => {
  phase = "final";
  showFinalScores(payload);
});

// =====================================================================
// Phase entry / exit
// =====================================================================

window.hsInit = function hsInit() {
  // Google Maps has loaded. Build the map full-screen for HIDE phase.
  phase = "hide";
  renderPhaseBanner();
  renderRoster();
  buildHideMap();
  updateFloatingPanelForPhase();
};

function buildHideMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 20, lng: 0 },
    zoom: 2,
    disableDefaultUI: true,
    gestureHandling: "greedy",
    streetViewControl: true,
    streetViewControlOptions: {
      position: google.maps.ControlPosition.LEFT_BOTTOM
    },
    mapId: "1b65baa89de7a1e3"
  });
  map.setOptions({ clickableIcons: false });

  // The built-in StreetView pane owned by the map.
  mainStreetView = map.getStreetView();
  mainStreetView.setOptions({
    disableDefaultUI: true,
    enableCloseButton: true,
    showRoadLabels: false
  });
  // Apply the current photosphere rule — restricts the pegman's pano
  // resolution to outdoor Google coverage when photospheres are disallowed.
  applyHideMapPhotosphereFilter();

  // When inside SV during the hide phase, show the compass, and hide the
  // app's back-button so the Google Maps Street View close (×) button
  // isn't obscured. Exiting SV restores both.
  const backBtn = document.getElementById("back-button");
  mainStreetView.addListener("visible_changed", () => {
    if (mainStreetView.getVisible()) {
      compassEl.classList.remove("hidden");
      if (backBtn) backBtn.classList.add("hidden");
    } else {
      compassEl.classList.add("hidden");
      if (backBtn) backBtn.classList.remove("hidden");
    }
  });
  mainStreetView.addListener("pov_changed", () => {
    if (!compassImage) return;
    compassImage.style.transform = `rotate(${mainStreetView.getPov().heading}deg)`;
  });

  // Pegman can be dropped in spots with no Street View coverage (common at
  // a zoomed-out view) — that produces a black screen with no feedback.
  // Watch status; if it's anything other than OK, bail out and tell the
  // user why so they can retry on a covered road.
  mainStreetView.addListener("status_changed", () => {
    const status = mainStreetView.getStatus();
    if (mainStreetView.getVisible() &&
        status && status !== google.maps.StreetViewStatus.OK) {
      mainStreetView.setVisible(false);
      showMessage("No Street View coverage at that spot — zoom in and drop the yellow pegman on a blue-highlighted road.", { title: "No coverage" });
    }
  });

  // Safety net: if a standalone photosphere somehow resolves (e.g. the user
  // dropped on a photosphere dot before our options update arrived), close
  // it and tell them. Navigable non-Google coverage is allowed through.
  //
  // pano_changed fires on every walk step, so we cache per-panoId results
  // and only call StreetViewService the first time we see a pano. Without
  // this, wandering inside non-Google coverage quickly tripped the Maps
  // API rate limit.
  mainStreetView.addListener("pano_changed", () => {
    if (hsAllowPhotospheres) return;
    if (!mainStreetView.getVisible()) return;
    const panoId = mainStreetView.getPano();
    if (!panoId) return;
    if (hsPanoAllowed.has(panoId)) return;
    if (hsPanoBlocked.has(panoId)) {
      mainStreetView.setVisible(false);
      showMessage(STANDALONE_PHOTOSPHERE_MSG, { title: "Hiding spot not allowed" });
      return;
    }
    const sv = new google.maps.StreetViewService();
    sv.getPanorama({ pano: panoId }, (data, status) => {
      if (status !== google.maps.StreetViewStatus.OK || !data) return;
      if (mainStreetView.getPano() !== panoId) return;             // already moved on
      if (isHidingSpotAllowed(data)) {
        hsPanoAllowed.add(panoId);
      } else {
        hsPanoBlocked.add(panoId);
        if (mainStreetView.getVisible()) {
          mainStreetView.setVisible(false);
          showMessage(STANDALONE_PHOTOSPHERE_MSG, { title: "Hiding spot not allowed" });
        }
      }
    });
  });
}

// Shared rule for which panos can be used as a hiding spot. The goal is to
// block STANDALONE 360° photospheres (a single static image, no navigation)
// while still allowing both official Google coverage AND user-contributed
// coverage that's connected — i.e. has adjacent pano links you can walk to.
// The photosphere toggle only affects the standalone case; anything with
// movement is allowed in both modes.
function isHidingSpotAllowed(data) {
  if (hsAllowPhotospheres) return true;
  if (!data) return false;
  const copyright = (data.copyright || "").toLowerCase();
  if (copyright.includes("google")) return true;
  const hasMovement = Array.isArray(data.links) && data.links.length > 0;
  return hasMovement;
}

// Cache of validated panos so the `pano_changed` listener doesn't re-hit
// StreetViewService on every walk step — that was tripping the Maps API
// rate limit when users wandered around inside non-Google coverage.
const hsPanoAllowed = new Set();
const hsPanoBlocked = new Set();
const STANDALONE_PHOTOSPHERE_MSG =
  "Standalone photospheres aren't allowed in this game — pick a spot with connected Street View coverage.";

// Toggle the pegman's street-view source so the user can't land on a
// photosphere when the host has disabled them. `source: OUTDOOR` filters the
// pano resolution step — unsupported photospheres fall back to the nearest
// outdoor pano, which is the behaviour we want.
function applyHideMapPhotosphereFilter() {
  if (!mainStreetView || !google.maps || !google.maps.StreetViewSource) return;
  const source = hsAllowPhotospheres
    ? google.maps.StreetViewSource.DEFAULT
    : google.maps.StreetViewSource.OUTDOOR;
  mainStreetView.setOptions({ source });
}

function enterHidePhase() {
  phase = "hide";
  // Wipe per-round state so rounds 2+ start from a clean slate (on round 1
  // these are already at their defaults, so the clears are no-ops).
  myHidingSpot = null;
  if (myHidingSpotMarker) { myHidingSpotMarker.map = null; myHidingSpotMarker = null; }
  myGuessPosition = null;
  myGuessLocked = false;
  myGuessMarker = null;
  isOwnerThisRound = false;
  revealedOwnerId = null;
  roundOwner = null;
  liveViews = {};
  spectatorTarget = null;
  spectatorAppliedPanoId = null;
  stopSpectatorInterpolation();
  guessLockedThisRound = new Set();
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  hideReveal();
  clearRoundMap();

  // Restore hide-phase chrome: world-view map with pegman re-enabled.
  phaseBanner.style.display = "";
  panocss.classList.add("hidden");
  panocss.classList.remove("awaiting-spectator");
  panocss.classList.remove("spectating-locked");
  mapcss.classList.remove("swapped");
  hiderTabs.classList.add("hidden");
  timer.style.display = "none";
  if (map) {
    map.setOptions({ streetViewControl: true });
    map.setCenter({ lat: 20, lng: 0 });
    map.setZoom(2);
    google.maps.event.trigger(map, "resize");
  }

  renderPhaseBanner();
  updateFloatingPanelForPhase();
  renderRoster();
}

function enterSeekPhase() {
  phase = "seek";
  renderPhaseBanner();
  updateFloatingPanelForPhase();
  // Exit the hide-phase SV; retire the pegman control so nobody accidentally
  // re-enters it during seek.
  if (mainStreetView && mainStreetView.getVisible()) mainStreetView.setVisible(false);
  if (map) map.setOptions({ streetViewControl: false });

  // Wire up map click → drop guess pin. We add listeners once and reuse
  // them every round; the handler inspects current state (owner? already
  // locked?) before doing anything.
  if (!seekMapClickListener && map) {
    seekMapClickListener = map.addListener("click", (e) => {
      if (phase !== "seek" || isOwnerThisRound || myGuessLocked) return;
      placeSeekerGuess(e.latLng);
    });
    // Clicks on the GeoJSON data layer (country polygons) don't bubble to
    // the map's click listener, so mirror it.
    map.data.addListener("click", (e) => {
      if (phase !== "seek" || isOwnerThisRound || myGuessLocked) return;
      placeSeekerGuess(e.latLng);
    });
  }
  google.maps.event.trigger(map, "resize");
  renderRoster();
}

function startSeekRound(data) {
  // { roundIdx, currentRound, totalRounds, hiderIdx, totalHidersThisRound,
  //   ownerId, ownerName, ownerColour, panoId, heading, pitch, timerSeconds,
  //   players }
  phase = "seek";
  currentRoundIdx = data.roundIdx;
  totalRounds = data.totalRounds;
  displayRound = Number.isFinite(data.currentRound) ? data.currentRound : 0;
  currentHiderIdx = Number.isFinite(data.hiderIdx) ? data.hiderIdx : 0;
  totalHidersThisRound = Number.isFinite(data.totalHidersThisRound) ? data.totalHidersThisRound : 0;
  roundOwner = data.ownerId
    ? { id: data.ownerId, name: data.ownerName || "", colour: data.ownerColour || "#94A3B8" }
    : null;
  isOwnerThisRound = !!(data.ownerId && data.ownerId === socket.id);
  revealedOwnerId = null;
  pendingRoundPanoId = data.panoId;
  pendingRoundPose = { heading: data.heading || 0, pitch: data.pitch || 0 };
  // 0 means "no timer" (lobby checkbox off). Anything else is the exact value.
  roundTimerSec = Number.isFinite(data.timerSeconds) ? data.timerSeconds : 90;
  myGuessPosition = null;
  myGuessLocked = false;
  myGuessMarker = null;
  liveViews = {};
  spectatorTarget = null;
  spectatorAppliedPanoId = null;
  stopSpectatorInterpolation();
  panocss.classList.remove("spectating-locked");
  guessLockedThisRound = new Set();

  clearRoundMap();
  hideReveal();
  phaseBanner.style.display = "";
  renderPhaseBanner();
  updateFloatingPanelForPhase();
  renderRoster();
  clearSpectatorPano();
  spectatorPanel.classList.add("hidden");
  timer.style.display = roundTimerSec > 0 ? "block" : "none";
  // Legacy floating #spectator-toggle is unused after the hider-tabs rework;
  // keep it hidden regardless of role.
  spectatorToggle.classList.add("hidden");

  // Each sub-round (each hider's spot) starts from a blank-slate map view.
  if (map) {
    map.setCenter({ lat: 20, lng: 0 });
    map.setZoom(2);
  }

  // Ownership is known synchronously from the payload — go straight to the
  // correct view instead of flashing seeker-UI then switching.
  if (isOwnerThisRound) resolveOwnershipAsOwner();
  else resolveOwnershipAsSeeker();
  resetTimer();
}

function clearRoundMap() {
  for (const m of roundMarkers) { m.map = null; }
  roundMarkers = [];
  for (const pl of roundPolylines) { pl.setMap(null); }
  roundPolylines = [];
  if (myGuessMarker) { myGuessMarker.map = null; myGuessMarker = null; }
  if (ownerFlagMarker) { ownerFlagMarker.map = null; ownerFlagMarker = null; }
}

function resolveOwnershipAsOwner() {
  // Owner view: pano fills the screen (spectating a seeker), map shrinks
  // to the corner (flag + incoming pins). A top tab strip lets the hider
  // cycle through seekers to watch.
  panocss.classList.remove("hidden");
  panocss.classList.add("spectating-locked");  // absorb all pointer events
  mapcss.classList.add("swapped");
  renderPhaseBanner();
  // Show tab strip; seed tabs from current roster. Updates arrive via
  // hsLiveViewUpdate — the first seeker to emit a pose auto-selects.
  renderHiderTabs();
  hiderTabs.classList.remove("hidden");
  // Set up the pano in "awaiting" state — the shimmer CSS explains that
  // we're waiting for a seeker to start moving.
  ensureSeekStreetView();
  panocss.classList.add("awaiting-spectator");
  // Drop a flag on the mini-map at their own hiding spot, so they have a
  // clear reference for incoming pins.
  if (myHidingSpot) {
    ownerFlagMarker = createMarker(
      { lat: myHidingSpot.lat, lng: myHidingSpot.lng },
      "flag"
    );
    map.panTo({ lat: myHidingSpot.lat, lng: myHidingSpot.lng });
    map.setZoom(4);
  }
  google.maps.event.trigger(map, "resize");
  updateFloatingPanelForPhase();
}

function resolveOwnershipAsSeeker() {
  // Seeker view: pano fills the screen, map in the corner (same pattern as
  // classic game). Click map (or country polygon) to drop a single pin.
  panocss.classList.remove("hidden");
  panocss.classList.remove("awaiting-spectator");
  panocss.classList.remove("spectating-locked");  // seeker drives their own pano
  stopSpectatorInterpolation();
  mapcss.classList.add("swapped");
  hiderTabs.classList.add("hidden");
  renderPhaseBanner();
  if (pendingRoundPanoId) {
    loadSeekerPano(pendingRoundPanoId, pendingRoundPose.heading, pendingRoundPose.pitch);
  }
  google.maps.event.trigger(map, "resize");
  updateFloatingPanelForPhase();
}

// Called on map click while the user is a seeker with no guess yet.
function placeSeekerGuess(latLng) {
  if (!latLng || !map) return;
  const pos = { lat: latLng.lat(), lng: latLng.lng() };
  if (myGuessMarker) { myGuessMarker.map = null; }
  myGuessMarker = createMarker(pos, playerColour || "#2563EB");
  myGuessPosition = pos;
  updateFloatingPanelForPhase();  // enables Confirm Guess button
}

// Draw a marker on the shared map and remember it for later cleanup.
function createMarker(position, colour) {
  const content = (colour === "flag")
    ? (() => {
        const img = document.createElement("img");
        img.src = "../imgs/red-flag.png";
        img.style.width = "56px";
        img.style.height = "40px";
        img.style.pointerEvents = "none";
        return img;
      })()
    : new google.maps.marker.PinElement({ background: colour, borderColor: "#ffffff" }).element;
  const marker = new google.maps.marker.AdvancedMarkerElement({
    position,
    map,
    content
  });
  roundMarkers.push(marker);
  return marker;
}

function addRoundMarker(position, colour) {
  createMarker(position, colour);
}

// Lazily create the main #pano StreetView instance (reused for both seekers
// and hider spectating). Listeners are attached once; throttledEmitLiveView
// no-ops when the player is the round's hider, so hider pose never leaks.
function ensureSeekStreetView() {
  if (seekStreetView) return seekStreetView;
  seekStreetView = new google.maps.StreetViewPanorama(panocss, {
    disableDefaultUI: true,
    showRoadLabels: false,
    addressControl: false,
    linksControl: true,
    clickToGo: true,
    scrollwheel: true,
    motionTracking: false,
    motionTrackingControl: false
  });
  seekStreetView.addListener("pov_changed", () => {
    const pov = seekStreetView.getPov();
    if (compassImage) compassImage.style.transform = `rotate(${pov.heading}deg)`;
    throttledEmitLiveView();
  });
  seekStreetView.addListener("position_changed", throttledEmitLiveView);
  seekStreetView.addListener("pano_changed", throttledEmitLiveView);
  seekStreetView.addListener("status_changed", () => {
    if (seekStreetView.getStatus() === google.maps.StreetViewStatus.OK) {
      loadingSpinner.style.display = "none";
      panocss.classList.remove("is-loading");
    }
  });
  return seekStreetView;
}

function loadSeekerPano(panoId, heading, pitch) {
  loadingSpinner.style.display = "block";
  panocss.classList.add("is-loading");
  ensureSeekStreetView();
  seekStreetView.setOptions({ clickToGo: true, scrollwheel: true, linksControl: true });
  seekStreetView.setPano(panoId);
  seekStreetView.setPov({ heading, pitch });
  spectatorAppliedPanoId = null;  // seekStreetView is now showing the seeker's own pano, not a spectator feed
  compassEl.classList.remove("hidden");
  // Kick an initial broadcast so our tab appears for others even before we move.
  setTimeout(() => throttledEmitLiveView(true), 400);
}

function throttledEmitLiveView(force) {
  if (phase !== "seek" || isOwnerThisRound || !seekStreetView) return;
  const now = Date.now();
  if (!force && now - liveViewLastEmit < LIVE_VIEW_THROTTLE_MS) return;
  liveViewLastEmit = now;
  const pov = seekStreetView.getPov();
  socket.emit("hsLiveView", {
    room: roomName,
    panoId: seekStreetView.getPano(),
    heading: pov.heading,
    pitch: pov.pitch,
    zoom: pov.zoom || 0
  });
}

// =====================================================================
// Timer (client ticks locally; server is ultimate authority)
// =====================================================================
function resetTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  timer.classList.remove("warning", "critical");
  // When the lobby timer is off (roundTimerSec === 0), the server won't
  // auto-advance — the round ends via all-guessed. Just leave the UI hidden.
  if (roundTimerSec <= 0) return;
  renderTimer();
  countdownInterval = setInterval(() => {
    roundTimerSec--;
    if (roundTimerSec <= 0) {
      clearInterval(countdownInterval);
      roundTimerSec = 0;
    }
    renderTimer();
  }, 1000);
}

function renderTimer() {
  const m = Math.floor(roundTimerSec / 60);
  const s = roundTimerSec % 60;
  timer.textContent = `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  timer.classList.toggle("critical", roundTimerSec <= 10);
  timer.classList.toggle("warning", roundTimerSec > 10 && roundTimerSec <= 30);
}

// =====================================================================
// UI: phase banner + floating action panel
// =====================================================================
function renderPhaseBanner() {
  phaseBanner.dataset.phase = phase;
  if (phase === "hide") {
    phaseLabel.textContent = "HIDE PHASE";
    phaseSub.textContent = "Pick a Street View spot";
  } else if (phase === "seek") {
    const r = Math.max(1, displayRound + 1);
    const totalDisplay = totalRounds >= 99999 ? "∞" : totalRounds;
    phaseLabel.textContent = `SEEK · ROUND ${r}/${totalDisplay}`;
    const spotSuffix = totalHidersThisRound > 1
      ? ` · Spot ${currentHiderIdx + 1}/${totalHidersThisRound}`
      : "";
    if (isOwnerThisRound) {
      phaseSub.textContent = "You're hiding — watch the seekers" + spotSuffix;
    } else if (roundOwner && roundOwner.name) {
      // innerHTML so we can tint the hider name with their player colour.
      phaseSub.innerHTML =
        `Finding <span class="hider-inline" style="--player-color:${roundOwner.colour}">${escapeHtml(roundOwner.name)}</span>'s spot${escapeHtml(spotSuffix)}`;
    } else {
      phaseSub.textContent = "Whose hiding spot is this?" + spotSuffix;
    }
  } else if (phase === "final") {
    phaseLabel.textContent = "GAME OVER";
    phaseSub.textContent = "";
  }
}

function updateFloatingPanelForPhase() {
  if (phase === "hide") {
    const alreadyLocked = !!myHidingSpot;
    lockSpotButton.style.display = alreadyLocked ? "none" : "inline-flex";
    unlockSpotButton.style.display = alreadyLocked ? "inline-flex" : "none";
    guessButton.style.display = "none";
    if (hsReturnToStartButton) hsReturnToStartButton.style.display = "none";
  } else if (phase === "seek") {
    lockSpotButton.style.display = "none";
    unlockSpotButton.style.display = "none";
    if (isOwnerThisRound) {
      guessButton.style.display = "none";
    } else if (myGuessLocked) {
      guessButton.style.display = "inline-flex";
      guessButton.disabled = true;
      guessButton.textContent = "Guess Locked";
    } else if (myGuessPosition) {
      guessButton.style.display = "inline-flex";
      guessButton.disabled = false;
      guessButton.textContent = "Confirm Guess";
    } else {
      guessButton.style.display = "inline-flex";
      guessButton.disabled = true;
      guessButton.textContent = "Click map to guess";
    }
    // Seekers always get the Start Location escape hatch; the hider's
    // pano is a spectator feed and doesn't have a fixed start to return to.
    if (hsReturnToStartButton) {
      hsReturnToStartButton.style.display = isOwnerThisRound ? "none" : "inline-flex";
    }
  } else {
    lockSpotButton.style.display = "none";
    unlockSpotButton.style.display = "none";
    guessButton.style.display = "none";
    if (hsReturnToStartButton) hsReturnToStartButton.style.display = "none";
  }
}

// =====================================================================
// Roster / scoreboard panel (left side)
// =====================================================================
function renderRoster() {
  if (phase === "hide") {
    rosterTitle.textContent = "Ready Check";
  } else if (phase === "seek") {
    rosterTitle.textContent = "Scoreboard";
  } else {
    rosterTitle.textContent = "Players";
  }
  rosterList.innerHTML = "";
  const ids = Object.keys(roomPlayers);
  for (const sid of ids) {
    const p = roomPlayers[sid];
    const li = document.createElement("li");
    if (sid === socket.id) li.classList.add("is-me");
    const hostTag = sid === currentHostId ? `<span class="host-badge">HOST</span>` : "";
    if (phase === "hide") {
      if (readySet.has(sid)) li.classList.add("ready");
      li.innerHTML = `
        <span class="player-chip" style="--player-color:${p.colour}">${escapeHtml(p.name)}${sid === socket.id ? " (you)" : ""}</span>
        ${hostTag}
        <span class="ready-dot" aria-hidden="true"></span>`;
    } else if (phase === "seek") {
      // We can't style "this is the owner" until the reveal — don't leak.
      if (revealedOwnerId && sid === revealedOwnerId) li.classList.add("is-owner");
      const scoreStr = (scoreSnapshot[sid] || 0).toLocaleString();
      const guessTag = (currentRoundIdx >= 0 && guessLockedThisRound.has(sid))
        ? `<span class="guess-badge">GUESSED</span>` : "";
      li.innerHTML = `
        <span class="player-chip" style="--player-color:${p.colour}">${escapeHtml(p.name)}${sid === socket.id ? " (you)" : ""}</span>
        ${hostTag}
        ${guessTag}
        <span class="score-value">${scoreStr}</span>`;
    } else {
      li.innerHTML = `
        <span class="player-chip" style="--player-color:${p.colour}">${escapeHtml(p.name)}</span>
        ${hostTag}
        <span class="score-value">${(scoreSnapshot[sid] || 0).toLocaleString()}</span>`;
    }
    rosterList.appendChild(li);
  }
}

// Scoreboard cache so we can render between hsRoundReveal events.
let scoreSnapshot = {};
// Which seekers have locked a guess for the current round (visual tag only).
let guessLockedThisRound = new Set();
function markGuessLocked(seekerId) {
  guessLockedThisRound.add(seekerId);
  renderRoster();
}

// =====================================================================
// HIDE phase — Lock In / Unlock buttons
// =====================================================================
lockSpotButton.addEventListener("click", () => {
  if (!mainStreetView || !mainStreetView.getVisible()) {
    showMessage("Open Street View first — drag the yellow pegman onto the map, pick a spot to hide, then press Lock In.", { title: "Pick a spot" });
    return;
  }
  const pos = mainStreetView.getPosition();
  const pov = mainStreetView.getPov();
  const panoId = mainStreetView.getPano();
  if (!pos || !panoId) {
    showMessage("Street View isn't fully loaded yet — hold on a moment.", { title: "Loading" });
    return;
  }
  const spot = {
    panoId,
    lat: pos.lat(),
    lng: pos.lng(),
    heading: pov.heading || 0,
    pitch: pov.pitch || 0
  };
  const commit = () => {
    myHidingSpot = spot;
    if (myHidingSpotMarker) { myHidingSpotMarker.map = null; }
    // Drop a player-coloured pin at the locked position so the hider has
    // visual confirmation when they exit Street View back to the world map.
    myHidingSpotMarker = createMarker(
      { lat: spot.lat, lng: spot.lng },
      playerColour || "#2563EB"
    );
    socket.emit("hsLockHidingSpot", { room: roomName, ...myHidingSpot });
    updateFloatingPanelForPhase();
  };
  // When the host disables photospheres, the pano must either be official
  // Google coverage or user-contributed coverage with movement (links to
  // adjacent panos). See isHidingSpotAllowed for the shared rule. We reuse
  // the pano_changed cache so Lock usually doesn't cost an extra API call.
  if (!hsAllowPhotospheres) {
    if (hsPanoAllowed.has(panoId)) { commit(); return; }
    if (hsPanoBlocked.has(panoId)) {
      showMessage(STANDALONE_PHOTOSPHERE_MSG, { title: "Hiding spot not allowed" });
      return;
    }
    const sv = new google.maps.StreetViewService();
    sv.getPanorama({ pano: panoId }, (data, status) => {
      if (status !== google.maps.StreetViewStatus.OK || !data) {
        showMessage("Couldn't verify this pano. Try another spot.", { title: "Verification failed" });
        return;
      }
      if (!isHidingSpotAllowed(data)) {
        hsPanoBlocked.add(panoId);
        showMessage(STANDALONE_PHOTOSPHERE_MSG, { title: "Hiding spot not allowed" });
        return;
      }
      hsPanoAllowed.add(panoId);
      commit();
    });
  } else {
    commit();
  }
});

unlockSpotButton.addEventListener("click", () => {
  myHidingSpot = null;
  if (myHidingSpotMarker) { myHidingSpotMarker.map = null; myHidingSpotMarker = null; }
  socket.emit("hsUnlockHidingSpot", { room: roomName });
  updateFloatingPanelForPhase();
});

// End Game — host-only escape hatch that jumps straight to the final
// scoreboard from any phase. Gated by a confirm to avoid fat-finger kills.
if (hosting && endGameButton) endGameButton.classList.remove("hidden");
if (endGameButton) {
  endGameButton.addEventListener("click", async () => {
    if (!hosting) return;
    const ok = await showConfirm("End the game now and show final scores?", {
      title: "End Game", okText: "End Game", danger: true
    });
    if (!ok) return;
    socket.emit("hsEndGame", { room: roomName });
  });
}

// Seeker-only: jump the pano back to the round's starting pano + pose.
// Mirrors classic's "Start Location" button. Doesn't reset the guess pin —
// the seeker can navigate away and back without losing their committed guess.
if (hsReturnToStartButton) {
  hsReturnToStartButton.addEventListener("click", () => {
    if (phase !== "seek" || isOwnerThisRound) return;
    if (!seekStreetView || !pendingRoundPanoId) return;
    seekStreetView.setPano(pendingRoundPanoId);
    seekStreetView.setPov({
      heading: (pendingRoundPose && pendingRoundPose.heading) || 0,
      pitch: (pendingRoundPose && pendingRoundPose.pitch) || 0
    });
  });
}

// =====================================================================
// SEEK phase — Confirm Guess
// =====================================================================
guessButton.addEventListener("click", () => {
  if (myGuessLocked || !myGuessPosition || isOwnerThisRound) return;
  myGuessLocked = true;
  socket.emit("hsSubmitGuess", {
    room: roomName,
    guessPosition: myGuessPosition
  });
  updateFloatingPanelForPhase();
  guessLockedThisRound.add(socket.id);
  renderRoster();
});

// Legacy guess-picker modal — no longer used. Kept in DOM but hidden.
if (guessPickerCancel) {
  guessPickerCancel.addEventListener("click", () => {
    guessPicker.classList.add("hidden");
  });
}
if (guessPicker) guessPicker.classList.add("hidden");

// Host clicks Next Round from the reveal overlay → server advances.
if (revealNextButton) {
  revealNextButton.addEventListener("click", () => {
    if (!hosting) return;
    revealNextButton.disabled = true;
    revealCountdown.textContent = "Advancing…";
    socket.emit("hsNextRound", { room: roomName });
  });
}

// =====================================================================
// HIDER spectator tabs — drives the main #pano from a selected seeker's
// live view. Used only while isOwnerThisRound === true.
// =====================================================================
function renderHiderTabs() {
  if (!hiderTabsList) return;
  hiderTabsList.innerHTML = "";
  // We render ALL other players as potential tabs. The hider is never
  // shown among themselves; the round's owner IS the viewer, so by
  // construction tabs = seekers.
  const others = Object.keys(roomPlayers).filter(sid => sid !== socket.id);
  if (!others.length) return;
  for (const sid of others) {
    const p = roomPlayers[sid];
    if (!p) continue;
    const btn = document.createElement("button");
    btn.className = "hider-tab" + (sid === spectatorTarget ? " active" : "");
    btn.style.setProperty("--tab-color", p.colour);
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", sid === spectatorTarget ? "true" : "false");
    btn.innerHTML = `<span class="tab-dot"></span>${escapeHtml(p.name)}`;
    btn.addEventListener("click", () => {
      spectatorTarget = sid;
      spectatorAppliedPanoId = null;   // force a setPano on the new target
      renderHiderTabs();
      applySpectatorToMainPano();
    });
    hiderTabsList.appendChild(btn);
  }
}

// Apply spectatorTarget's liveView state to the main #pano instance.
// Performance notes:
//   - setPano() triggers a full Street View reload (network fetch + render).
//     Only call when the seeker actually moves to a different panorama.
//   - setOptions() re-binds SV controls; only call on pano change, not on
//     every pose update.
//   - POV is tweened via RAF (tickSpectatorInterpolation) so ~10 Hz network
//     updates feel continuous instead of stepped.
function applySpectatorToMainPano() {
  if (!isOwnerThisRound) return;  // safety: only hider writes to main pano
  const view = liveViews[spectatorTarget];
  if (!view || !view.panoId) {
    panocss.classList.add("awaiting-spectator");
    return;
  }
  panocss.classList.remove("awaiting-spectator");
  ensureSeekStreetView();

  if (spectatorAppliedPanoId !== view.panoId) {
    // New pano — lock inputs, play the "walking forward" fade/zoom so the
    // hider reads the swap as motion, then swap the pano and snap pov to
    // avoid tweening across a full reload (which would look like a pan).
    seekStreetView.setOptions({ clickToGo: false, scrollwheel: false, linksControl: false });
    playSpectatorWarp();
    seekStreetView.setPano(view.panoId);
    spectatorAppliedPanoId = view.panoId;
    spectatorCurrentPov = {
      heading: view.heading || 0,
      pitch: view.pitch || 0,
      zoom: (typeof view.zoom === "number" && view.zoom > 0) ? view.zoom : 1
    };
    seekStreetView.setPov({ heading: spectatorCurrentPov.heading, pitch: spectatorCurrentPov.pitch });
    seekStreetView.setZoom(spectatorCurrentPov.zoom);
  }

  // Latest pose becomes the tween target. RAF loop catches us up smoothly.
  const prevTarget = spectatorTargetPov;
  spectatorTargetPov = {
    heading: view.heading || 0,
    pitch: view.pitch || 0,
    zoom: (typeof view.zoom === "number" && view.zoom > 0)
      ? view.zoom
      : (prevTarget ? prevTarget.zoom : (spectatorCurrentPov ? spectatorCurrentPov.zoom : 1))
  };
  if (!spectatorCurrentPov) spectatorCurrentPov = { ...spectatorTargetPov };
  if (!spectatorRafHandle) spectatorRafHandle = requestAnimationFrame(tickSpectatorInterpolation);
}

// Per-frame catch-up toward spectatorTargetPov. alpha=0.22 at 60 fps gets us
// ~75% of the way in ~90 ms, which masks the 100 ms emit cadence without
// lagging far behind the seeker's actual motion.
function tickSpectatorInterpolation() {
  spectatorRafHandle = null;
  if (!isOwnerThisRound || !spectatorTargetPov || !spectatorCurrentPov || !seekStreetView) return;
  const alpha = 0.22;
  const h1 = spectatorCurrentPov.heading;
  const h2 = spectatorTargetPov.heading;
  const dh = ((h2 - h1 + 540) % 360) - 180;  // shortest angular delta
  spectatorCurrentPov.heading = h1 + dh * alpha;
  spectatorCurrentPov.pitch   += (spectatorTargetPov.pitch - spectatorCurrentPov.pitch) * alpha;
  spectatorCurrentPov.zoom    += (spectatorTargetPov.zoom  - spectatorCurrentPov.zoom)  * alpha;
  seekStreetView.setPov({ heading: spectatorCurrentPov.heading, pitch: spectatorCurrentPov.pitch });
  if (Math.abs(spectatorCurrentPov.zoom - spectatorTargetPov.zoom) > 0.01) {
    seekStreetView.setZoom(spectatorCurrentPov.zoom);
  }
  const stillMoving =
    Math.abs(dh) > 0.05 ||
    Math.abs(spectatorTargetPov.pitch - spectatorCurrentPov.pitch) > 0.05 ||
    Math.abs(spectatorTargetPov.zoom  - spectatorCurrentPov.zoom)  > 0.005;
  if (stillMoving) spectatorRafHandle = requestAnimationFrame(tickSpectatorInterpolation);
}

function stopSpectatorInterpolation() {
  if (spectatorRafHandle) { cancelAnimationFrame(spectatorRafHandle); spectatorRafHandle = null; }
  spectatorTargetPov = null;
  spectatorCurrentPov = null;
  // Belt-and-braces: if a warp was in progress when the hider exits spectator
  // mode, drop the class so the pano doesn't stay blurred/dimmed.
  if (spectatorWarpTimer) { clearTimeout(spectatorWarpTimer); spectatorWarpTimer = null; }
  if (panocss) panocss.classList.remove("spectator-warping");
}

function clearSpectatorPano() {
  panocss.classList.remove("awaiting-spectator");
}

// Play the brief forward-warp animation (see .spectator-warping in CSS) on
// the pano container. Kept short — Google SV's own load happens in parallel,
// and a longer dim would feel like a stutter instead of a step forward.
let spectatorWarpTimer = null;
function playSpectatorWarp() {
  if (!panocss) return;
  if (spectatorWarpTimer) clearTimeout(spectatorWarpTimer);
  panocss.classList.add("spectator-warping");
  spectatorWarpTimer = setTimeout(() => {
    panocss.classList.remove("spectator-warping");
    spectatorWarpTimer = null;
  }, 360);
}

// =====================================================================
// REVEAL overlay
// =====================================================================
function showReveal(payload) {
  // { roundIdx, ownerId, ownerPosition, ownerDisconnected, guesses, delta, scoresTotal }
  // guesses[seekerId] = { position, colour, distanceKm, score } | null
  phase = "reveal";
  revealedOwnerId = payload.ownerId;
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (countdownOverlay) countdownOverlay.classList.add("hidden");
  timer.style.display = "none";
  // The reveal card anchors top-center now; hide the phase banner to avoid
  // stacking with it. startSeekRound restores it on the next round.
  phaseBanner.style.display = "none";
  scoreSnapshot = payload.scoresTotal || {};
  guessLockedThisRound = new Set();
  const owner = roomPlayers[payload.ownerId] || { name: "(left game)", colour: "#94A3B8" };
  // Reveal card header shows the outer round; spot progress is appended when
  // the round has multiple hiders so players can see how many spots are left.
  const outerRound = Number.isFinite(payload.currentRound) ? payload.currentRound + 1 : (payload.roundIdx + 1);
  const outerTotal = Number.isFinite(payload.totalRounds) ? payload.totalRounds : totalRounds;
  const outerTotalDisplay = outerTotal >= 99999 ? "∞" : outerTotal;
  const hidersInRound = Number.isFinite(payload.totalHidersThisRound) ? payload.totalHidersThisRound : 0;
  const spotSuffix = hidersInRound > 1
    ? ` · Spot ${payload.hiderIdx + 1}/${hidersInRound}`
    : "";
  revealRoundNum.textContent = `${outerRound}/${outerTotalDisplay}${spotSuffix}`;
  revealOwnerName.style.setProperty("--player-color", owner.colour);
  revealOwnerName.textContent = owner.name + (payload.ownerDisconnected ? " (disconnected)" : "");

  // Everyone gets the full reveal view on the map: map fills the screen,
  // pano hides, flag at the true location, all pins + polylines.
  mapcss.classList.remove("swapped");
  panocss.classList.add("hidden");
  panocss.classList.remove("spectating-locked");
  stopSpectatorInterpolation();
  spectatorPanel.classList.add("hidden");
  clearRoundMap();
  const allCoords = [];
  if (payload.ownerPosition) {
    ownerFlagMarker = createMarker(payload.ownerPosition, "flag");
    allCoords.push(payload.ownerPosition);
  }
  for (const sid in (payload.guesses || {})) {
    const g = payload.guesses[sid];
    if (!g || !g.position) continue;
    addRoundMarker(g.position, g.colour || "#888");
    allCoords.push(g.position);
    if (payload.ownerPosition) {
      const pl = new google.maps.Polyline({
        path: [g.position, payload.ownerPosition],
        geodesic: true,
        strokeColor: g.colour || "#888",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map
      });
      roundPolylines.push(pl);
    }
  }
  if (allCoords.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    allCoords.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { top: 120, right: 40, bottom: 40, left: 40 });
  }

  revealGuesses.innerHTML = "";
  const seekerIds = Object.keys(roomPlayers).filter(sid => sid !== payload.ownerId);
  for (const sid of seekerIds) {
    const g = payload.guesses && payload.guesses[sid];
    const me = roomPlayers[sid];
    if (!me) continue;
    const li = document.createElement("li");
    const score = g ? g.score : 0;
    li.classList.add(score >= 3000 ? "correct" : "wrong");
    const distStr = g
      ? `${Number(g.distanceKm || 0).toLocaleString()} km`
      : "— no guess";
    li.innerHTML = `
      <span class="player-chip" style="--player-color:${me.colour}">${escapeHtml(me.name)}</span>
      <span class="guess-arrow">${escapeHtml(distStr)}</span>
      <span class="guess-delta">${score > 0 ? "+" : ""}${score.toLocaleString()}</span>`;
    revealGuesses.appendChild(li);
  }
  // Hider's points-this-round line.
  const hiderDelta = payload.delta && payload.delta[payload.ownerId];
  if (hiderDelta) {
    const li = document.createElement("li");
    li.classList.add("wrong");
    li.innerHTML = `
      <span class="player-chip" style="--player-color:${owner.colour}">${escapeHtml(owner.name)} (hider)</span>
      <span class="guess-arrow">earned</span>
      <span class="guess-delta">+${hiderDelta.toLocaleString()}</span>`;
    revealGuesses.appendChild(li);
  }

  // Hide the hider's spectator chrome while reveal is showing.
  hiderTabs.classList.add("hidden");
  panocss.classList.remove("awaiting-spectator");

  revealOverlay.classList.remove("hidden");
  if (revealCountdownInterval) { clearInterval(revealCountdownInterval); revealCountdownInterval = null; }

  // Host-only Next Round button; non-hosts see a waiting message.
  if (hosting) {
    revealCountdown.textContent = "Press Next Round when ready.";
    revealNextButton.style.display = "inline-flex";
    revealNextButton.disabled = false;
    revealNextButton.textContent = payload.isFinalReveal ? "Show Final Scores" : "Next Round";
  } else {
    revealCountdown.textContent = "Waiting for host to continue…";
    revealNextButton.style.display = "none";
  }
}

function hideReveal() {
  revealOverlay.classList.add("hidden");
  if (revealCountdownInterval) {
    clearInterval(revealCountdownInterval);
    revealCountdownInterval = null;
  }
}

// =====================================================================
// FINAL scoreboard
// =====================================================================
function showFinalScores(payload) {
  // { totals, players, roundOrder, guesses, locked }
  hideReveal();
  spectatorPanel.classList.add("hidden");
  spectatorToggle.classList.add("hidden");
  if (endGameButton) endGameButton.classList.add("hidden");
  if (countdownOverlay) countdownOverlay.classList.add("hidden");
  timer.style.display = "none";
  if (countdownInterval) clearInterval(countdownInterval);
  phaseBanner.style.display = "";
  phaseBanner.dataset.phase = "final";
  phaseLabel.textContent = "GAME OVER";
  phaseSub.textContent = "";

  const totals = payload.totals || {};
  const players = payload.players || roomPlayers;

  const ranked = Object.keys(totals)
    .map(sid => ({ sid, total: totals[sid] || 0 }))
    .sort((a, b) => b.total - a.total);

  // Winner banner
  if (scoresWinner && ranked.length) {
    const winnerId = ranked[0].sid;
    const wname = (winnerId === socket.id) ? "You" : (players[winnerId] ? players[winnerId].name : winnerId);
    scoresWinner.innerHTML = `
      <svg class="trophy-icon" viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path fill="currentColor" d="M6 3h12v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5 6 6 0 0 1-4 2.91V19h3a1 1 0 0 1 1 1v1H7v-1a1 1 0 0 1 1-1h3v-3.09A6 6 0 0 1 7 13a5 5 0 0 1-5-5V6a1 1 0 0 1 1-1h3V3Zm0 4H4v1a3 3 0 0 0 2 2.83V7Zm12 0v3.83A3 3 0 0 0 20 8V7h-2Z"/>
      </svg>
      <span>${escapeHtml(wname)} — ${ranked[0].total.toLocaleString()} pts</span>`;
  }

  scoresList.innerHTML = "";
  const table = document.createElement("table");
  table.className = "scores-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Rank</th><th>Player</th><th>Score</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  ranked.forEach((row, idx) => {
    const p = players[row.sid];
    const tr = document.createElement("tr");
    if (idx === 0) tr.className = "totals-row winner";
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="player-chip" style="--player-color:${p ? p.colour : "#94A3B8"}">${escapeHtml(p ? p.name : row.sid)}${row.sid === socket.id ? " (you)" : ""}</span></td>
      <td>${row.total.toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scoresList.appendChild(table);

  scoresMenu.classList.remove("hidden");
  scoresMenu.classList.add("visible");
}

// =====================================================================
// Utility
// =====================================================================
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Tell the server we're leaving gracefully on tab close.
window.addEventListener("beforeunload", () => {
  socket.emit("hsLeave", { room: roomName });
});
