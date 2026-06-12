import { serverURL as server } from "./config.js";
import { emitWithAck, attachConnectionBanner } from "./connection.js";

const nameInput = document.getElementById("name");
const submitButton = document.getElementById("submit-button");
const errorMessage = document.getElementById("error-message");
const colorInput = document.getElementById("color-input");
const roomCode = localStorage.getItem("roomId");

const socket = io(server, {
    withCredentials: true
});
attachConnectionBanner(socket);

var roomName = localStorage.getItem("roomId")

if (roomName == null){
    socket.emit("checkPlayerDetails", {}, (response) => {
        if (!response) return;
        if (response.success){
            window.location.href = "hub.html";
        } else if (response.message === "Not All Player details available") {
            if (response.details && response.details.colour){
                colorInput.value = response.details.colour
            } else if (response.details && response.details.username){
                nameInput.value = response.details.username
            }
        }
    })
}else{
    socket.emit("checkPlayerDetails", {}, (response) => {
        if (!response) return;
        if (response.success){
            localStorage.setItem("playerName", response.username);
            localStorage.setItem("playerColour", response.colour);
            window.location.href = "lobby.html";
        }
    })
}

colorInput.addEventListener("input", () => {
    colorInput.style.backgroundColor = colorInput.value;
});

// Set initial color preview
colorInput.style.backgroundColor = colorInput.value;

async function handleSubmit() {
    const name = nameInput.value.trim();
    const colour = colorInput.value;
    errorMessage.textContent = "";

    if (name === "") {
        errorMessage.textContent = "Please enter a name.";
        return;
    }

    localStorage.setItem("playerName", name);
    localStorage.setItem("playerColour", colour);

    if (roomName == null) {
        socket.emit("updatePlayerDetails", { colour: colour, name: name }, (response) => {
            if (response && response.success) window.location.href = "hub.html";
        });
        return;
    }

    submitButton.classList.add("is-pending");
    submitButton.disabled = true;
    try {
        const res = await emitWithAck(socket, "joinRoom", [roomCode, name, colour]);
        if (res && res.ok) {
            if (res.gameType === "catan") {
                errorMessage.textContent = "That code is a Catan room — join it from the Catan page.";
                submitButton.classList.remove("is-pending");
                submitButton.disabled = false;
                return;
            }
            // success → navigation is driven by the goToRoom listener.
        } else {
            errorMessage.textContent = res && res.error === "invalid_code"
                ? "That room code doesn't look right."
                : "Room not found. Check the code and try again.";
            submitButton.classList.remove("is-pending");
            submitButton.disabled = false;
        }
    } catch (e) {
        errorMessage.textContent = "Server isn't responding — please try again.";
        submitButton.classList.remove("is-pending");
        submitButton.disabled = false;
    }
}

document.getElementById("join-form").addEventListener("submit", (e) => { e.preventDefault(); handleSubmit(); });

socket.on("goToRoom", (roomName, gameType) => {
    // Catan rooms have their own join flow (pages/catan/home.html).
    if (gameType === "catan") {
        errorMessage.textContent = "That code is a Catan room — join it from the Catan page.";
        return;
    }
    window.location.href = "lobby.html";
})


