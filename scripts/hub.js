import { serverURL as server } from "./config.js";

// NOTE: unlike main.js/login.js, the hub must NOT clear localStorage —
// Catan stores its room state in catan* keys and players navigate
// game -> hub -> back while a game is live.

const loginStatus = document.getElementById("loginStatus");
const loginButton = document.getElementById("login-button");

const socket = io(server, {
  withCredentials: true
});

loginStatus.textContent = "";
loginButton.style.display = "none";
socket.emit("validateCookie", {}, response => {
  if (response && response.success) {
    loginStatus.textContent = `Logged in: ${response.username}`;
    loginStatus.setAttribute("aria-label", "Open your profile");
    loginButton.style.display = "";
  } else {
    loginStatus.textContent = "Sign in";
    loginStatus.setAttribute("aria-label", "Sign in");
    loginStatus.onclick = () => { window.location.href = "../index.html"; };
  }
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
