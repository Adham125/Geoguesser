import { serverURL as server } from "./config.js";
import { populateCountryDropdown } from "./countries.js";
import { showMessage, showToast } from "./popup.js";
import { attachConnectionBanner } from "./connection.js";

const roomCodeDisplay = document.getElementById('roomCode');
const roundsSelect = document.getElementById('rounds');
const gameModeSelect = document.getElementById("game-mode");
const timer = document.getElementById("timer");
const timerDropdown = document.getElementById("timerDropdown");
const movingCheck = document.getElementById("moving")
const zoomingCheck = document.getElementById("zooming")
const countrySelect = document.getElementById("country-select");
const hsSettings = document.getElementById("hs-settings");
const hsAllowPhotospheresCheck = document.getElementById("hsAllowPhotospheres");
const startButton = document.getElementById("start-btn");
const playerList = document.getElementById("players-ul");

const socket = io(server, {
    withCredentials: true
  });
attachConnectionBanner(socket);

var playerName = localStorage.getItem("playerName")
var colour = localStorage.getItem("playerColour")
var roomName = localStorage.getItem("roomId")

if (!roomName || !playerName) {
    showToast("Your room session expired — start again.", { type: "warning" });
    setTimeout(() => { window.location.href = "./main.html"; }, 1200);
    throw new Error("missing lobby state"); // stop module init cleanly
}

roundsSelect.value = "99999"

// Server is authoritative for host identity; localStorage is only a hint
// until the first `hostChanged` socket event arrives. Start button is
// disabled by default and re-enabled when we receive hostChanged for us.
let currentHostId = null;
let currentPlayers = {};
startButton.disabled = true;

socket.emit("joinedRoom", [roomName, playerName, colour])

roomCodeDisplay.textContent = `Room Code: ${roomName}`;

startButton.addEventListener("click", function() {
    if (currentHostId !== socket.id) return;
    socket.emit("startGame", roomName);
});

function renderPlayerList() {
    playerList.innerHTML = "";
    const amHost = currentHostId && currentHostId === socket.id;
    for (const sid in currentPlayers) {
        const li = document.createElement("li");
        const isHost = sid === currentHostId;
        const isMe = sid === socket.id;

        const colorIndicator = document.createElement("div");
        colorIndicator.classList.add("player-color-indicator");
        colorIndicator.style.backgroundColor = currentPlayers[sid].colour;

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("player-name-text");
        nameSpan.textContent = currentPlayers[sid].name + (isMe ? " (you)" : "");

        li.appendChild(colorIndicator);
        li.appendChild(nameSpan);

        if (isHost) {
            const hostBadge = document.createElement("span");
            hostBadge.classList.add("host-badge");
            hostBadge.textContent = "HOST";
            li.appendChild(hostBadge);
        }

        // If I'm host, clicking another player opens a small menu with
        // "Make Host" / "Kick Player" actions.
        if (amHost && !isMe) {
            li.classList.add("transferable");
            li.title = `Actions for ${currentPlayers[sid].name}`;
            li.tabIndex = 0;
            li.setAttribute("role", "button");
            li.setAttribute("aria-haspopup", "menu");
            li.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPlayerMenu(li, sid, currentPlayers[sid].name);
                }
            });
            li.addEventListener("click", (e) => {
                e.stopPropagation();
                openPlayerMenu(li, sid, currentPlayers[sid].name);
            });
        }

        playerList.appendChild(li);
    }
}

function openPlayerMenu(anchorLi, targetSid, targetName) {
    // Toggle: clicking the same row again closes the menu.
    const existing = document.querySelector(".player-menu");
    if (existing) {
        const openFor = existing.dataset.sid;
        existing.remove();
        document.removeEventListener("click", closePlayerMenuOnOutside, true);
        if (openFor === targetSid) return;
    }

    const menu = document.createElement("div");
    menu.className = "player-menu";
    menu.dataset.sid = targetSid;

    const header = document.createElement("div");
    header.className = "player-menu-header";
    header.textContent = targetName;
    menu.appendChild(header);

    const makeHostBtn = document.createElement("button");
    makeHostBtn.type = "button";
    makeHostBtn.className = "player-menu-item";
    makeHostBtn.textContent = "Make Host";
    makeHostBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        socket.emit("transferHost", [roomName, targetSid]);
        closePlayerMenu();
    });
    menu.appendChild(makeHostBtn);

    const kickBtn = document.createElement("button");
    kickBtn.type = "button";
    kickBtn.className = "player-menu-item player-menu-item--danger";
    kickBtn.textContent = "Kick Player";
    kickBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        socket.emit("kickPlayer", [roomName, targetSid]);
        closePlayerMenu();
    });
    menu.appendChild(kickBtn);

    anchorLi.appendChild(menu);
    // Register outside-click listener on the next tick so the click that
    // opened the menu doesn't also close it.
    setTimeout(() => {
        document.addEventListener("click", closePlayerMenuOnOutside, true);
    }, 0);
}

function closePlayerMenu() {
    const m = document.querySelector(".player-menu");
    if (m) m.remove();
    document.removeEventListener("click", closePlayerMenuOnOutside, true);
}

function closePlayerMenuOnOutside(e) {
    const menu = document.querySelector(".player-menu");
    if (!menu) return;
    if (!menu.contains(e.target)) closePlayerMenu();
}

socket.on("playerJoined", (players) => {
    currentPlayers = players || {};
    renderPlayerList();
});

// When a player disconnects (closes tab, navigates Home, etc.) the server
// emits `playerLeft` with the updated players dict. Without this handler the
// lobby kept showing stale entries after a post-game Home/Play-Again split.
socket.on("playerLeft", ({ players }) => {
    if (players) currentPlayers = players;
    renderPlayerList();
});

socket.on("hostChanged", ({ hostId }) => {
    currentHostId = hostId;
    const amHost = hostId === socket.id;
    localStorage.setItem("roomHost", amHost ? "true" : "false");
    startButton.disabled = !amHost;
    showToast(amHost ? "You are now the host." : "Host changed.", { type: "info", duration: 2500 });
    renderPlayerList();
});

socket.on("kicked", async ({ reason } = {}) => {
    await showMessage(reason || "You were removed from the room by the host.", {
        title: "Removed from room"
    });
    window.location.href = './main.html';
});

socket.on("roomOptionsUpdate", options => {
    updateOptions(options)
})

socket.on("goToGame", function() {
    startGame()
})

// While applying a server-pushed options snapshot, suppress the emit side
// of change handlers — otherwise programmatic dispatchEvent('change') calls
// in updateOptions() bounce the same options back to the server and cause
// a broadcast loop.
let applyingServerOptions = false;

function emitOptions() {
    if (applyingServerOptions) return;
    // Options shape (index 8 adds the H&S photosphere toggle):
    // [roomName, gamemode, moving, zooming, timer, timerDropdown, rounds, countryISO, hsAllowPhotospheres]
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value, hsAllowPhotospheresCheck.checked]);
}

gameModeSelect.addEventListener("change", function () {
    const countrySelectContainer = document.getElementById("country-select-container");
    if (this.value === "countrySelect") {
      countrySelectContainer.style.display = "block";
      populateCountryDropdown();
    } else {
      countrySelectContainer.style.display = "none";
    }
    if (hsSettings) {
      hsSettings.style.display = this.value === "hideAndSeek" ? "block" : "none";
    }
    emitOptions();
});

movingCheck.addEventListener("change", emitOptions);
zoomingCheck.addEventListener("change", emitOptions);
if (hsAllowPhotospheresCheck) hsAllowPhotospheresCheck.addEventListener("change", emitOptions);

timer.addEventListener("change", (event) => {
    timerDropdown.style.display = event.target.checked ? "block" : "none";
    emitOptions();
});

timerDropdown.addEventListener("change", emitOptions);
roundsSelect.addEventListener("change", emitOptions);
countrySelect.addEventListener("change", emitOptions);

function updateOptions(options) {
    applyingServerOptions = true;
    try {
        if (gameModeSelect.value != options[1]) {
            gameModeSelect.value = options[1];
            gameModeSelect.dispatchEvent(new Event('change'));
        }
        movingCheck.checked = !!options[2];
        zoomingCheck.checked = !!options[3];
        if (timer.checked != options[4]) {
            timer.checked = !!options[4];
            timer.dispatchEvent(new Event('change'));
        }
        timerDropdown.value = options[5];
        roundsSelect.value = options[6];
        countrySelect.value = options[7];
        if (hsAllowPhotospheresCheck) hsAllowPhotospheresCheck.checked = !!options[8];
    } finally {
        applyingServerOptions = false;
    }
}

function startGame(){
    var gamemode = gameModeSelect.value;  // Get the selected game mode

    if(gamemode === "classic"){
        localStorage.setItem("gameMode", JSON.stringify("classic"));
    }else if(gamemode === "countrySelect"){
        localStorage.setItem("gameMode", JSON.stringify("countrySelect"));
    }else if(gamemode === "hideAndSeek"){
        localStorage.setItem("gameMode", JSON.stringify("hideAndSeek"));
      }

    const options = {
        moving: document.getElementById("moving").checked,
        zooming: document.getElementById("zooming").checked,
        timer: document.getElementById("timer").checked,
        // H&S-specific — persisted so the game page has it before the first
        // roomOptionsUpdate socket event fires.
        hsAllowPhotospheres: hsAllowPhotospheresCheck ? hsAllowPhotospheresCheck.checked : false
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

    localStorage.setItem("roomCode", JSON.stringify(roomName));
    
    if (gamemode === "hideAndSeek"){
        window.location.href = 'hideAndSeek.html';
    }else{
        window.location.href = 'game.html';
    }
}