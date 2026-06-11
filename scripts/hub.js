import { serverURL as server } from "./config.js";

// NOTE: unlike main.js/login.js, the hub must NOT clear localStorage —
// Catan stores its room state in catan* keys and players navigate
// game -> hub -> back while a game is live.

const loginStatus = document.getElementById("loginStatus");
const loginButton = document.getElementById("login-button");

const socket = io(server, {
  withCredentials: true
});

document.addEventListener('DOMContentLoaded', () => {
  socket.emit("validateCookie", {}, response => {
    if (response && response.success) {
      loginStatus.innerText = `Logged in: ${response.username}`;
    }
  });
});

loginStatus.addEventListener("click", () => {
  window.location.href = './profile.html';
});

loginButton.addEventListener("click", () => {
  sessionStorage.setItem("stay", true);
  socket.emit("logout", {}, () => {
    window.location.href = '../index.html';
  });
});
