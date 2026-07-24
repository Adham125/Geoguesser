import { serverURL as server } from "./config.js";
import { showMessage } from "./popup.js";

const usernameButton = document.getElementById("username-input");
const passwordButton = document.getElementById("password-input");
const loginButton = document.getElementById("login");
const signUpButton = document.getElementById('signUp-button');
const guestButton = document.getElementById('loginStatus');
// Preserve spotify_* keys through the cross-page reset — see main.js for the rationale.
(() => {
  const keep = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('spotify_')) keep[k] = localStorage.getItem(k);
  }
  localStorage.clear();
  for (const k in keep) localStorage.setItem(k, keep[k]);
})();

const socket = io(server, {
    withCredentials: true
});

guestButton.addEventListener('click', (event) => {
    window.location.href = './pages/hub.html'
});

const authForm = document.getElementById('auth-form');
authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    loginButton.classList.add('is-pending');
    loginButton.disabled = true;
    try {
        const response = await fetch(`${server}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
            window.location.href = './pages/hub.html';
            return;
        }
        showMessage(data.message || "Login failed. Check your email and password.", { title: "Login failed" });
    } catch (e) {
        showMessage("Couldn't reach the server. Check your connection and try again.", { title: "Connection error" });
    } finally {
        loginButton.classList.remove('is-pending');
        loginButton.disabled = false;
    }
});

signUpButton.addEventListener('click', (event) => {
    event.preventDefault();
    const email = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    signUpButton.classList.add('is-pending');
    signUpButton.disabled = true;
    socket.emit('signup', { email, password }, async (response) => {
        try {
            if (response && response.success) {
                const r = await fetch(`${server}/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }), credentials: 'include'
                });
                const data = await r.json().catch(() => ({}));
                if (r.ok && data.success) { window.location.href = './pages/playerDetails.html'; return; }
                showMessage("Account created — please log in.", { title: "Account created" });
            } else {
                showMessage((response && response.message) || "Signup failed.", { title: "Signup failed" });
            }
        } catch (e) {
            showMessage("Account created, but auto sign-in failed. Please log in.", { title: "Account created" });
        } finally {
            signUpButton.classList.remove('is-pending');
            signUpButton.disabled = false;
        }
    });
});


// ----- Forgot-password flow: login form <-> step 1 (email) <-> step 2 (code) --
const forgotLink = document.getElementById('forgot-link');
const forgotStep1 = document.getElementById('forgot-step1');
const forgotStep2 = document.getElementById('forgot-step2');
const forgotEmail = document.getElementById('forgot-email');
const sendCodeButton = document.getElementById('send-code');
const resetButton = document.getElementById('do-reset');

function showLoginView() {
    authForm.style.display = '';
    forgotLink.style.display = '';
    forgotStep1.style.display = 'none';
    forgotStep2.style.display = 'none';
}

forgotLink.addEventListener('click', () => {
    forgotEmail.value = usernameButton.value; // carry over anything typed
    authForm.style.display = 'none';
    forgotLink.style.display = 'none';
    forgotStep1.style.display = '';
});

for (const btn of document.querySelectorAll('.back-to-login')) {
    btn.addEventListener('click', showLoginView);
}

forgotStep1.addEventListener('submit', async (event) => {
    event.preventDefault();
    sendCodeButton.classList.add('is-pending');
    sendCodeButton.disabled = true;
    try {
        const response = await fetch(`${server}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail.value })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
            showMessage(data.message, { title: "Check your email" });
            forgotStep1.style.display = 'none';
            forgotStep2.style.display = '';
        } else {
            showMessage(data.message || "Couldn't send a reset code. Try again later.", { title: "Password reset" });
        }
    } catch (e) {
        showMessage("Couldn't reach the server. Check your connection and try again.", { title: "Connection error" });
    } finally {
        sendCodeButton.classList.remove('is-pending');
        sendCodeButton.disabled = false;
    }
});

forgotStep2.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetButton.classList.add('is-pending');
    resetButton.disabled = true;
    try {
        const response = await fetch(`${server}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: forgotEmail.value,
                code: document.getElementById('reset-code').value,
                newPassword: document.getElementById('new-password').value
            })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
            showMessage("Password updated — please log in.", { title: "Password reset" });
            usernameButton.value = forgotEmail.value;
            passwordButton.value = '';
            showLoginView();
        } else {
            showMessage(data.message || "Invalid or expired code.", { title: "Password reset" });
        }
    } catch (e) {
        showMessage("Couldn't reach the server. Check your connection and try again.", { title: "Connection error" });
    } finally {
        resetButton.classList.remove('is-pending');
        resetButton.disabled = false;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    socket.emit("validateCookie", {}, response => {
        if (response && response.success) {
            if (guestButton) {
                guestButton.innerText = `Logged in: ${response.username || response.email || ''}`;
            }
            if (!sessionStorage.getItem("stay")) {
                window.location.href = './pages/hub.html';
            }
        }
    })
});