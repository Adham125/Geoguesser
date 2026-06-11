// Catan home — create a room or join by code. Reuses the shared lobby
// socket events (createRoom/joinRoom); rooms created here carry
// gameType 'catan' so the Geoguesser join flow bounces them and vice versa.

import { serverURL as server } from "../config.js";

const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const joinCode = document.getElementById("join-code");
const errorMessage = document.getElementById("error-message");

const socket = io(server, { withCredentials: true });

// Same charset as the Geoguesser room codes (scripts/main.js).
function generateRoomCode(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

createBtn.addEventListener("click", () => {
  const roomName = generateRoomCode(5);
  localStorage.setItem("catanRoomId", roomName);
  localStorage.setItem("catanHost", "true");
  socket.emit("createRoom", [roomName, ["catan"]]);
  // Give the emit a beat to flush before navigation tears the socket down.
  setTimeout(() => { window.location.href = "./lobby.html"; }, 150);
});

joinBtn.addEventListener("click", () => {
  const code = joinCode.value.trim().toUpperCase();
  errorMessage.textContent = "";
  if (!code) {
    errorMessage.textContent = "Enter a room code.";
    return;
  }
  socket.emit("joinRoom", [code]);
  // If the room doesn't exist the server stays silent — show a hint.
  setTimeout(() => {
    if (!document.hidden && errorMessage.textContent === "") {
      errorMessage.textContent = "Room not found.";
    }
  }, 1500);
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
