// Catan lobby — ready check. Everyone who opens the lobby joins the room
// immediately (so the roster shows all present players), then toggles
// Ready ✓ / ✗. The host can start once 2–4 players are all ready.
// Reuses the shared room events (joinedRoom/playerJoined/hostChanged/
// kickPlayer) plus catan:ready / catan:start.

import { serverURL as server } from "../config.js";
import { createRenderer } from "./render.js";
import { attachConnectionBanner } from "../connection.js";

const roomCode = localStorage.getItem("catanRoomId");
if (!roomCode) window.location.href = "./home.html";

const roomCodeText = document.getElementById("room-code-text");
const roomCodeCopy = document.getElementById("room-code-copy");
const copyFeedback = document.getElementById("copy-feedback");
const nameInput = document.getElementById("name-input");
const colourInput = document.getElementById("colour-input");
const readyBtn = document.getElementById("ready-btn");
const errorMessage = document.getElementById("error-message");
const roster = document.getElementById("roster");
const startBtn = document.getElementById("start-btn");
const lobbyError = document.getElementById("lobby-error");

roomCodeText.textContent = roomCode;
document.title = `Catan — Room ${roomCode}`;

roomCodeCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    copyFeedback.textContent = "Copied!";
  } catch {
    copyFeedback.textContent = "Press Ctrl+C to copy";
  }
  setTimeout(() => { copyFeedback.textContent = ""; }, 1800);
});

const socket = io(server, { withCredentials: true });
attachConnectionBanner(socket);

let players = {};
let hostId = null;
let ready = false;
let joined = false;

// --- map picker --------------------------------------------------------
const mapRow = document.getElementById("map-row");
const previewSvg = document.getElementById("map-preview-svg");
const mapHint = document.getElementById("map-hint");
let currentMapId = "classic";

function updateMapPills() {
  const isHost = socket.id === hostId;
  for (const btn of mapRow.querySelectorAll(".map-pill")) {
    btn.classList.toggle("selected", btn.getAttribute("data-map") === currentMapId);
    btn.disabled = !isHost;
  }
  mapHint.textContent = isHost
    ? "Pick a map — click again to reroll it."
    : "The host picks the map.";
}

function renderMapPreview(board) {
  if (!board) { previewSvg.innerHTML = ""; return; }
  // Reuse the game-board renderer; viewBox scaling shrinks it for free.
  // Hit targets are never armed, so the preview is inert.
  const renderer = createRenderer(previewSvg, board);
  renderer.render({
    occupied: { vertices: {}, edges: {} },
    robberHex: board.robberHex,
    seats: [],
  });
}

mapRow.addEventListener("click", e => {
  const btn = e.target.closest(".map-pill");
  if (!btn || socket.id !== hostId) return;
  socket.emit("catan:mapSelect", { roomCode, mapId: btn.getAttribute("data-map") });
});

socket.on("catan:mapUpdate", ({ mapId, board }) => {
  currentMapId = mapId;
  updateMapPills();
  renderMapPreview(board);
});

// --- turn timer ---
const timerRow = document.getElementById("timer-row");
let currentTimerSec = 0;

function updateTimerPills() {
  const isHost = socket.id === hostId;
  for (const btn of timerRow.querySelectorAll(".map-pill")) {
    btn.classList.toggle("selected", Number(btn.getAttribute("data-sec")) === currentTimerSec);
    btn.disabled = !isHost;
  }
}

timerRow.addEventListener("click", e => {
  const btn = e.target.closest(".map-pill");
  if (!btn || socket.id !== hostId) return;
  socket.emit("catan:setTimer", { roomCode, seconds: Number(btn.getAttribute("data-sec")) });
});

socket.on("catan:timerUpdate", ({ seconds }) => {
  currentTimerSec = seconds;
  updateTimerPills();
});

socket.emit("catan:getMap", { roomCode }, res => {
  if (!res) return;
  currentMapId = res.mapId;
  currentTimerSec = res.timerSec || 0;
  updateMapPills();
  updateTimerPills();
  renderMapPreview(res.board);
});
// ------------------------------------------------------------------------

const DEFAULT_COLOURS = ["#D64545", "#2E86AB", "#E8A33D", "#7B5EA7", "#4F9D5D", "#C2569B"];
colourInput.value = localStorage.getItem("catanColour")
  || DEFAULT_COLOURS[Math.floor(Math.random() * DEFAULT_COLOURS.length)];

function joinRoom() {
  const name = nameInput.value.trim() || "Settler";
  localStorage.setItem("catanName", name);
  localStorage.setItem("catanColour", colourInput.value);
  socket.emit("joinedRoom", [roomCode, name, colourInput.value]);
  joined = true;
}

// Join as soon as we know what to call the player: prefilled profile name
// for logged-in users, stored name from a refresh, else "Settler".
let prefillDone = false;
function initialJoin() {
  if (prefillDone) return;
  prefillDone = true;
  if (!nameInput.value) nameInput.value = localStorage.getItem("catanName") || "";
  if (!nameInput.value) nameInput.value = "Settler";
  joinRoom();
}

socket.emit("checkPlayerDetails", {}, response => {
  if (response) {
    const details = response.success
      ? { username: response.username, colour: response.colour }
      : response.details || {};
    if (details.username && !nameInput.value) nameInput.value = details.username;
    if (details.colour && !localStorage.getItem("catanColour")) colourInput.value = details.colour;
  }
  initialJoin();
});
// Fallback in case the details callback never fires.
setTimeout(initialJoin, 1200);

function setReady(next) {
  ready = next;
  if (ready) {
    const name = nameInput.value.trim();
    if (!name) {
      errorMessage.textContent = "Please enter a name.";
      ready = false;
      return;
    }
    errorMessage.textContent = "";
    joinRoom(); // push current name/colour before flagging ready
  }
  socket.emit("catan:ready", { roomCode, ready });
  nameInput.disabled = ready;
  colourInput.disabled = ready;
  readyBtn.textContent = ready ? "Not ready ✗" : "Ready ✓";
  readyBtn.classList.toggle("primary", !ready);
}

readyBtn.addEventListener("click", () => setReady(!ready));
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !ready) setReady(true);
});

function renderRoster() {
  roster.innerHTML = "";
  // Skip held disconnected slots (the geo grace hold has its own server-side
  // fix now, but a held row reaching this render by another path must not
  // show a ghost player either — same filter Geoguesser's lobby.js applies).
  const ids = Object.keys(players).filter(id => players[id].connected !== false);
  for (const id of ids) {
    const p = players[id];
    const row = document.createElement("div");
    row.className = "roster-row";
    const isReady = !!p.ready;
    const hostBadge = id === hostId ? '<span class="host-badge">HOST</span>' : "";
    const kick = (socket.id === hostId && id !== socket.id)
      ? `<button class="kick-btn" data-id="${id}" title="Remove player">kick</button>` : "";
    row.innerHTML = `
      <div class="player-swatch" style="background:${p.colour}"></div>
      <span class="roster-name">${escapeHtml(p.name)}${id === socket.id ? " (you)" : ""}</span>
      ${hostBadge}
      <span class="ready-mark ${isReady ? "is-ready" : "not-ready"}" title="${isReady ? "Ready" : "Not ready"}">${isReady ? "✓" : "✗"}</span>
      ${kick}`;
    roster.appendChild(row);
  }
  const isHost = socket.id === hostId;
  const allReady = ids.length > 0 && ids.every(id => players[id].ready);
  startBtn.disabled = !(isHost && ids.length >= 2 && ids.length <= 4 && allReady);
  if (!isHost) {
    startBtn.textContent = "Waiting for host…";
  } else if (ids.length < 2) {
    startBtn.textContent = `Start Game (${ids.length}/2 players)`;
  } else if (!allReady) {
    startBtn.textContent = "Start Game (waiting for ready)";
  } else {
    startBtn.textContent = "Start Game";
  }
  updateMapPills(); // host knowledge can change with the roster
  updateTimerPills();
}

roster.addEventListener("click", e => {
  const btn = e.target.closest(".kick-btn");
  if (!btn) return;
  socket.emit("kickPlayer", [roomCode, btn.getAttribute("data-id")]);
});

startBtn.addEventListener("click", () => {
  lobbyError.textContent = "";
  socket.emit("catan:start", { roomCode });
});

socket.on("playerJoined", p => { players = p; renderRoster(); });
socket.on("playerLeft", ({ players: p }) => { players = p; renderRoster(); });
socket.on("hostChanged", ({ hostId: h }) => { hostId = h; renderRoster(); });

socket.on("catan:seatToken", ({ token }) => {
  // Survives the lobby → game navigation; catan:rejoin presents it so
  // guests (whose session id may not be stable) keep their seat.
  localStorage.setItem("catanSeatToken", token);
});

socket.on("catan:goToGame", () => {
  window.location.href = "./game.html";
});

socket.on("catan:error", ({ reason }) => {
  lobbyError.textContent = reason;
});

socket.on("kicked", () => {
  localStorage.removeItem("catanRoomId");
  window.location.href = "./home.html";
});

// On socket reconnect (e.g. brief network blip), re-seat with the current
// details; ready state resets to ✗ by design.
socket.on("connect", () => {
  if (joined) {
    ready = false;
    nameInput.disabled = false;
    colourInput.disabled = false;
    readyBtn.textContent = "Ready ✓";
    readyBtn.classList.add("primary");
    joinRoom();
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
