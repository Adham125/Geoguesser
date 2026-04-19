import { serverURL as server } from "./config.js";
import { showMessage } from "./popup.js";

const usernameButton = document.getElementById("username-input");
const passwordButton = document.getElementById("password-input");
const loginButton = document.getElementById("login");
const signUpButton = document.getElementById('signUp-button');
const guestButton = document.getElementById('loginStatus');
localStorage.clear()

const socket = io(server, {
    withCredentials: true
});

guestButton.addEventListener('click', (event) => {
    window.location.href = './pages/main.html'
});

loginButton.addEventListener('click', (event) => {
    event.preventDefault();

    const email = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;

    fetch(`${server}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {

                console.log('Login successful');
                //window.location.reload();
                window.location.href = './pages/playerDetails.html';

            } else {
                console.error('Login failed:', data.message);
                showMessage(data.message || "Login failed.", { title: "Login failed" });
            }
        });

});

signUpButton.addEventListener('click', (event) => {
    event.preventDefault();

    const email = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;

    socket.emit('signup', { email, password }, (response) => {
        if (response.success) {
            console.log('Signup successful:', response);
            showMessage("Signup successful! Please login.", { title: "Account created" });
            // Clear the form fields (optional)
            document.getElementById('username-input').value = '';
            document.getElementById('password-input').value = '';
        } else {
            console.error('Signup failed:', response.message);
            showMessage(response.message || "Signup failed.", { title: "Signup failed" });
        }
    });
});


document.addEventListener('DOMContentLoaded', () => {
    socket.emit("validateCookie", {}, response => {
        if (response && response.success) {
            if (guestButton) {
                guestButton.innerText = `Logged in: ${response.username || response.email || ''}`;
            }
            if (!sessionStorage.getItem("stay")) {
                window.location.href = './pages/playerDetails.html';
            }
        }
    })
});