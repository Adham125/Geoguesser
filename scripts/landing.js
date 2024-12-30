const startButton = document.getElementById("start-btn");
const settingsButton = document.getElementById("settings-btn");
const gameModeSelect = document.getElementById("game-mode");
var gamemode = gameModeSelect.value;

localStorage.clear()

// Start Game Button Event Listener
startButton.addEventListener("click", function() {
    gamemode = gameModeSelect.value;  // Get the selected game mode
    //alert(`Starting the game in ${gameMode} mode!`);
    if(gamemode == "easy"){
        localStorage.setItem("gameMode", JSON.stringify("easy"));
    }else if(gamemode == "medium"){
        localStorage.setItem("gameMode", JSON.stringify("medium"));
    }else if(gamemode == "hard"){
        localStorage.setItem("gameMode", JSON.stringify("hard"));
    }
    
    window.location.href = 'pages/game.html';
});

// Settings Button Event Listener
settingsButton.addEventListener("click", function() {
    //alert("Settings clicked! You can add settings options here.");
});