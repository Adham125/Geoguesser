// Catan lobby — seat picker + roster. Reuses the shared room events
// (joinedRoom/playerJoined/hostChanged/kickPlayer); the start button emits
// catan:start instead of the Geoguesser startGame.

import { serverURL as server } from "../config.js";

const roomCode = localStorage.getItem("catanRoomId");
if (!roomCode) window.location.href = "./home.html";

const roomChip = document.getElementById("room-chip");
const detailsCard = document.getElementById("details-card");
const lobbyCard = document.getElementById("lobby-card");
const nameInput = document.getElementById("name-input");
const colourInput = document.getElementById("colour-input");
const sitBtn = document.getElementById("sit-btn");
const errorMessage = document.getElementById("error-message");
const roster = document.getElementById("roster");
const startBtn = document.getElementById("start-btn");
const lobbyError = document.getElementById("lobby-error");

roomChip.textContent = `ROOM ${roomCode}`;

const socket = io(server, { withCredentials: true });

let players = {};
let hostId = null;
let seated = false;

// Prefill name/colour for logged-in users (same source as the Geoguesser
// playerDetails page).
socket.emit("checkPlayerDetails", {}, response => {
  if (!response) return;
  const details = response.success
    ? { username: response.username, colour: response.colour }
    : response.details || {};
  if (details.username && !nameInput.value) nameInput.value = details.username;
  if (details.colour) colourInput.value = details.colour;
});

sitBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  errorMessage.textContent = "";
  if (!name) {
    errorMessage.textContent = "Please enter a name.";
    return;
  }
  localStorage.setItem("catanName", name);
  localStorage.setItem("catanColour", colourInput.value);
  socket.emit("joinedRoom", [roomCode, name, colourInput.value]);
  seated = true;
  detailsCard.hidden = true;
  lobbyCard.hidden = false;
});

nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sitBtn.click();
});

function renderRoster() {
  roster.innerHTML = "";
  const ids = Object.keys(players);
  for (const id of ids) {
    const p = players[id];
    const row = document.createElement("div");
    row.className = "roster-row";
    const hostBadge = id === hostId ? '<span class="host-badge">HOST</span>' : "";
    const kick = (socket.id === hostId && id !== socket.id)
      ? `<button class="kick-btn" data-id="${id}" title="Kick">✕</button>` : "";
    row.innerHTML = `
      <div class="player-swatch" style="background:${p.colour}"></div>
      <span class="roster-name">${escapeHtml(p.name)}${id === socket.id ? " (you)" : ""}</span>
      ${hostBadge}${kick}`;
    roster.appendChild(row);
  }
  const isHost = socket.id === hostId;
  startBtn.disabled = !(isHost && ids.length >= 3 && ids.length <= 4);
  startBtn.textContent = isHost
    ? (ids.length < 3 ? `Start Game (${ids.length}/3)` : "Start Game")
    : "Waiting for host…";
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

// If the page is reloaded mid-lobby, re-seat automatically.
socket.on("connect", () => {
  const name = localStorage.getItem("catanName");
  const colour = localStorage.getItem("catanColour");
  if (seated && name) {
    socket.emit("joinedRoom", [roomCode, name, colour]);
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
