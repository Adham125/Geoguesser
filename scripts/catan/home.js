// Catan home — create a room or join by code. Reuses the shared lobby
// socket events (createRoom/joinRoom); rooms created here carry
// gameType 'catan' so the Geoguesser join flow bounces them and vice versa.

import { serverURL as server } from "../config.js";
import { emitWithAck, attachConnectionBanner } from "../connection.js";

const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const joinCode = document.getElementById("join-code");
const errorMessage = document.getElementById("error-message");

const socket = io(server, { withCredentials: true });
attachConnectionBanner(socket);

// Offer a way back into a live game if this account still holds a seat —
// covers losing the local pointer (e.g. localStorage cleared by the landing
// page). Guests get nothing back; the button simply stays hidden.
socket.emit("catan:findMyGame", {}, res => {
  if (!res || !res.ok || !res.game) return;
  const card = document.getElementById("rejoin-card");
  const text = document.getElementById("rejoin-text");
  // textContent: the room code is server-supplied but this stays consistent
  // with the project's no-innerHTML-for-dynamic-values rule.
  text.textContent = `Room ${res.game.roomCode} · ${res.game.playerCount} players`;
  document.getElementById("rejoin-btn").addEventListener("click", () => {
    localStorage.setItem("catanRoomId", res.game.roomCode);
    window.location.href = "./game.html";
  });
  card.hidden = false;
});

// Same charset as the Geoguesser room codes (scripts/main.js).
function generateRoomCode(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

createBtn.addEventListener("click", async () => {
  const roomName = generateRoomCode(5);
  createBtn.classList.add("is-pending");
  createBtn.disabled = true;
  try {
    const res = await emitWithAck(socket, "createRoom", [roomName, ["catan"]]);
    if (res && res.ok) {
      localStorage.setItem("catanRoomId", res.code || roomName);
      localStorage.setItem("catanHost", "true");
      window.location.href = "./lobby.html";
    } else {
      errorMessage.textContent = "Couldn't create the game. Try again.";
    }
  } catch (e) {
    errorMessage.textContent = "Server isn't responding — please try again.";
  } finally {
    createBtn.classList.remove("is-pending");
    createBtn.disabled = false;
  }
});

joinBtn.addEventListener("click", async () => {
  const code = joinCode.value.trim().toUpperCase();
  errorMessage.textContent = "";
  if (!code) { errorMessage.textContent = "Enter a room code."; return; }
  joinBtn.classList.add("is-pending");
  joinBtn.disabled = true;
  try {
    const res = await emitWithAck(socket, "joinRoom", [code]);
    if (res && res.ok) {
      if (res.gameType !== "catan") {
        errorMessage.textContent = "That's a GeoGuesser room — join it from the GeoGuesser page.";
      }
      // success → goToRoom listener navigates (keeps the catan localStorage writes).
    } else {
      errorMessage.textContent = "Room not found.";
    }
  } catch (e) {
    errorMessage.textContent = "Server isn't responding — please try again.";
  } finally {
    joinBtn.classList.remove("is-pending");
    joinBtn.disabled = false;
  }
});

joinCode.addEventListener("keydown", e => {
  if (e.key === "Enter") joinBtn.click();
});

socket.on("goToRoom", (roomName, gameType) => {
  if (gameType !== "catan") {
    errorMessage.textContent = "That's a GeoGuesser room — join it from the GeoGuesser page.";
    return;
  }
  localStorage.setItem("catanRoomId", roomName);
  localStorage.setItem("catanHost", "false");
  window.location.href = "./lobby.html";
});
