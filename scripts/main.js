import { serverURL as server } from "./config.js";
import { populateCountryDropdown } from "./countries.js";

const startButton = document.getElementById("start-btn");
const createRoomButton = document.getElementById("join-btn");
const gameModeSelect = document.getElementById("game-mode");
const roundsSelect = document.getElementById('rounds');
const timer = document.getElementById("timer");
const timerDropdown = document.getElementById("timerDropdown");
const joinRoom = document.getElementById("join-room-button");
const loginStatus = document.getElementById("loginStatus");
const loginButton = document.getElementById("login-button")
var gamemode = gameModeSelect.value;

const socket = io(server, {
  withCredentials: true
});

document.addEventListener('DOMContentLoaded', () => {
  //const cookie = document.cookie
  socket.emit("validateCookie", {}, response => {
    if (response.success){
      loginStatus.innerText = `Logged in: ${response.username}`;
    }
  })
});

localStorage.clear()

roundsSelect.value = "99999"

loginStatus.addEventListener("click", (event) => {
  window.location.href = './profile.html';
})

loginButton.addEventListener("click", (event) => {
  sessionStorage.setItem("stay", true)
  socket.emit("logout", {}, (response) => {
    window.location.href = '../index.html';
  })
})

timer.addEventListener("change", (event) => {
  if (event.target.checked) {
    timerDropdown.style.display = "block"; // Show the dropdown
  } else {
    timerDropdown.style.display = "none"; // Hide the dropdown
  }
});

document.getElementById("game-mode").addEventListener("change", function () {
    const countrySelectContainer = document.getElementById("country-select-container");
    if (this.value === "countrySelect") {
      countrySelectContainer.style.display = "block";
      populateCountryDropdown(); // Populate the dropdown when shown
    } else {
      countrySelectContainer.style.display = "none";
    }
  });

// Start Game Button Event Listener
startButton.addEventListener("click", function() {
    gamemode = gameModeSelect.value;  // Get the selected game mode

    if(gamemode === "classic"){
        localStorage.setItem("gameMode", JSON.stringify("classic"));
    }else if(gamemode === "countrySelect"){
        localStorage.setItem("gameMode", JSON.stringify("countrySelect"));
    }

    const options = {
        moving: document.getElementById("moving").checked,
        zooming: document.getElementById("zooming").checked,
        timer: document.getElementById("timer").checked
    };
    localStorage.setItem("gameOptions", JSON.stringify(options));

    if (document.getElementById("timer").checked){
      localStorage.setItem("timer", JSON.stringify(document.getElementById("timerDropdown").value));
    }else{
      localStorage.setItem("timer", JSON.stringify(""));
    }

    const countrySelect = document.getElementById("country-select");
    localStorage.setItem("selectedCountry", JSON.stringify(countrySelect.value));

    const rounds = roundsSelect.value;
    localStorage.setItem("rounds", JSON.stringify(rounds));

    localStorage.setItem("roomCode", JSON.stringify("Singleplayer"));
    localStorage.setItem("roomHost", true);

    window.location.href = './game.html';
});


// Join Button Event Listener
createRoomButton.addEventListener("click", function() {
  const roundsSelect = document.getElementById('rounds');
  const gameModeSelect = document.getElementById("game-mode");
  const timer = document.getElementById("timer");
  const timerDropdown = document.getElementById("timerDropdown");
  const movingCheck = document.getElementById("moving")
  const zoomingCheck = document.getElementById("zooming")
  const countrySelect = document.getElementById("country-select");

  var roomName = generateRoomCode(5)
  localStorage.setItem("roomId", roomName)
  localStorage.setItem("roomHost", true)
  socket.emit('createRoom', [roomName, [gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value]] )

  window.location.href = './playerDetails.html';
}); 

joinRoom.addEventListener("click", function() {
  const roomCodeInput = document.getElementById('room-code-input').value;
  localStorage.setItem("roomId", roomCodeInput)
  localStorage.setItem("roomHost", false)
  window.location.href = './playerDetails.html';
})

  function generateRoomCode(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Letters and numbers
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}
