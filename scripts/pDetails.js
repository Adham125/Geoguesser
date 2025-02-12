const nameInput = document.getElementById("name");
const submitButton = document.getElementById("submit-button");
const errorMessage = document.getElementById("error-message");
const colorInput = document.getElementById("color-input");
const roomCode = localStorage.getItem("roomId");

const socket = io('http://16.171.186.49:3000');
//const socket = io('http://localhost:3000');

var roomName = localStorage.getItem("roomId")


colorInput.addEventListener("input", () => {
    colorInput.style.backgroundColor = colorInput.value;
});

// Set initial color preview
colorInput.style.backgroundColor = colorInput.value;

submitButton.addEventListener("click", () => {
    const name = nameInput.value.trim(); // Trim whitespace
    const colour = colorInput.value;

    errorMessage.textContent = ""; // Clear any previous errors

    if (name === "") {
        errorMessage.textContent = "Please enter a name.";
        return;
    }

    // Store the name and color (you can use localStorage, sessionStorage, or send it to the server)
    localStorage.setItem("playerName", name);
    localStorage.setItem("playerColour", colour);

    socket.emit('joinRoom', [roomCode, name, colour])
    
});

socket.on("goToRoom", roomName => {
    // Redirect to the game room page
    window.location.href = "lobby.html"; // Replace with your game room URL
})


