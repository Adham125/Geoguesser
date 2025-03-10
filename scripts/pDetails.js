const nameInput = document.getElementById("name");
const submitButton = document.getElementById("submit-button");
const errorMessage = document.getElementById("error-message");
const colorInput = document.getElementById("color-input");
const roomCode = localStorage.getItem("roomId");

const server = 'https://localhost'
//const socket = io('http://16.171.186.49:3000');
const socket = io(server, {
    withCredentials: true
});

var roomName = localStorage.getItem("roomId")

if (roomName == null){
    socket.emit("checkPlayerDetails", {}, (response) => {
        if (response.success){
            window.location.href = "main.html";
        }else if (response.message == "Not All Player details available") {
            if (response.details.colour){
                colorInput.value = response.details.colour
            }else{
                nameInput.value = response.details.username
            }
        }
    })
}else{
    socket.emit("checkPlayerDetails", {}, (response) => {
        console.log(response)
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

    if(roomName == null){
        socket.emit("updatePlayerDetails", {colour: colour, name: name}, (response) => {
            if (response.success){
                window.location.href = "main.html";
            }
        })
        
    }else{
        socket.emit('joinRoom', [roomCode, name, colour])
    }
    
    
});

socket.on("goToRoom", roomName => {
    window.location.href = "lobby.html"; 
})


