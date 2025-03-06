const usernameButton = document.getElementById("username-input");
const passwordButton = document.getElementById("password-input");
const loginButton = document.getElementById("login");
const signUpButton = document.getElementById('signUp-button');

localStorage.clear()

const server = 'https://localhost'
//const socket = io('http://16.171.186.49:3000');
const socket = io(server, {
    withCredentials: true
});

loginButton.addEventListener('click', (event) => {
    event.preventDefault();

    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;

    fetch(`${server}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
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
        }
    });
    
});

signUpButton.addEventListener('click', (event) => {
    event.preventDefault();

    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;

    socket.emit('signup', { username, password }, (response) => {
        if (response.success) {
            console.log('Signup successful:', response);
            alert("Signup successful! Please login");
            // Clear the form fields (optional)
            document.getElementById('username-input').value = '';
            document.getElementById('password-input').value = '';
        } else {
            console.error('Signup failed:', response.message);
            alert(response.message);
        }
    });
});


document.addEventListener('DOMContentLoaded', () => {
    socket.emit("validateCookie", {}, response => {
        if (response.success){
          loginStatus.innerText = `Logged in: ${response.username}`;
          if(!sessionStorage.getItem("stay")){
            window.location.href = './pages/playerDetails.html';
          }
        }
      })
});