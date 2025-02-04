const roomCodeDisplay = document.getElementById('roomCode');
const roundsSelect = document.getElementById('rounds');
const gameModeSelect = document.getElementById("game-mode");
const timer = document.getElementById("timer");
const timerDropdown = document.getElementById("timerDropdown");
const movingCheck = document.getElementById("moving")
const zoomingCheck = document.getElementById("zooming")
const countrySelect = document.getElementById("country-select");

const socket = io('http://16.171.186.49:3000');
//console.log(socket)
var roomName
roundsSelect.value = "99999"
const storedRoomId = sessionStorage.getItem('roomId');

if (storedRoomId != ""){
    roomName = storedRoomId
    socket.emit("joinRoom", roomName)
}else{
    roomName = generateRoomCode(5)
    socket.emit('createRoom', [roomName, [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value]] )
}

roomCodeDisplay.textContent = `Room Code: ${roomName}`;

socket.on("playerJoined", (players) => {
    console.log(players)
})

socket.on("roomOptionsUpdate", options => {
    updateOptions(options)
})

gameModeSelect.addEventListener("change", function () {
    const countrySelectContainer = document.getElementById("country-select-container");
    if (this.value === "countrySelect") {
      countrySelectContainer.style.display = "block";
      populateCountryDropdown(); // Populate the dropdown when shown
    } else {
      countrySelectContainer.style.display = "none";
    }
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
  });

movingCheck.addEventListener("change", function() {
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
})

zoomingCheck.addEventListener("change", function() {
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
})

timer.addEventListener("change", (event) => {
    if (event.target.checked) {
      timerDropdown.style.display = "block"; // Show the dropdown
    } else {
      timerDropdown.style.display = "none"; // Hide the dropdown
    }
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
});

timerDropdown.addEventListener("change", function() {
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
})

roundsSelect.addEventListener("change", function () {
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
})

countrySelect.addEventListener("change", function () {
    socket.emit("gameOptionsUpdate", [roomName, gameModeSelect.value, movingCheck.checked, zoomingCheck.checked, timer.checked, timerDropdown.value, roundsSelect.value, countrySelect.value])
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

var countries = [
    { name: "Albania", iso3: "ALB" },
    { name: "Andorra", iso3: "AND" },
    { name: "Argentina", iso3: "ARG" },
    { name: "Australia", iso3: "AUS" },
    { name: "Austria", iso3: "AUT" },
    { name: "Bahrain", iso3: "BHR" },
    { name: "Belarus", iso3: "BLR" },
    { name: "Belgium", iso3: "BEL" },
    { name: "Bosnia and Herzegovina", iso3: "BIH" },
    { name: "Brazil", iso3: "BRA" },
    { name: "Bulgaria", iso3: "BGR" },
    { name: "Cambodia", iso3: "KHM" },
    { name: "Canada", iso3: "CAN" },
    { name: "Chile", iso3: "CHL" },
    { name: "China", iso3: "CHN" },
    { name: "Colombia", iso3: "COL" },
    { name: "Costa Rica", iso3: "CRI" },
    { name: "Croatia", iso3: "HRV" },
    { name: "Czechia", iso3: "CZE" },
    { name: "Denmark", iso3: "DNK" },
    { name: "Dominican Republic", iso3: "DOM" },
    { name: "Ecuador", iso3: "ECU" },
    { name: "Egypt", iso3: "EGY" },
    { name: "Estonia", iso3: "EST" },
    { name: "Finland", iso3: "FIN" },
    { name: "France", iso3: "FRA" },
    { name: "Germany", iso3: "DEU" },
    { name: "Greece", iso3: "GRC" },
    { name: "Greenland", iso3: "GRL" },
    { name: "Guatemala", iso3: "GTM" },
    { name: "Hong Kong", iso3: "HKG" },
    { name: "Hungary", iso3: "HUN" },
    { name: "Iceland", iso3: "ISL" },
    { name: "India", iso3: "IND" },
    { name: "Indonesia", iso3: "IDN" },
    { name: "Ireland", iso3: "IRL" },
    { name: "Israel", iso3: "ISR" },
    { name: "Italy", iso3: "ITA" },
    { name: "Japan", iso3: "JPN" },
    { name: "Jordan", iso3: "JOR" },
    { name: "Kazakhstan", iso3: "KAZ" },
    { name: "Kenya", iso3: "KEN" },
    { name: "Korea, Republic of", iso3: "KOR" },
    { name: "Kyrgyzstan", iso3: "KGZ" },
    { name: "Lao People's Democratic Republic", iso3: "LAO" },
    { name: "Latvia", iso3: "LVA" },
    { name: "Lebanon", iso3: "LBN" },
    { name: "Lithuania", iso3: "LTU" },
    { name: "Luxembourg", iso3: "LUX" },
    { name: "Macao", iso3: "MAC" },
    { name: "Malta", iso3: "MLT" },
    { name: "Mexico", iso3: "MEX" },
    { name: "Mongolia", iso3: "MNG" },
    { name: "Montenegro", iso3: "MNE" },
    { name: "Netherlands", iso3: "NLD" },
    { name: "New Zealand", iso3: "NZL" },
    { name: "North Macedonia", iso3: "MKD" },
    { name: "Norway", iso3: "NOR" },
    { name: "Oman", iso3: "OMN" },
    { name: "Pakistan", iso3: "PAK" },
    { name: "Panama", iso3: "PAN" },
    { name: "Peru", iso3: "PER" },
    { name: "Philippines", iso3: "PHL" },
    { name: "Poland", iso3: "POL" },
    { name: "Portugal", iso3: "PRT" },
    { name: "Qatar", iso3: "QAT" },
    { name: "Romania", iso3: "ROU" },
    { name: "Russian Federation", iso3: "RUS" },
    { name: "Rwanda", iso3: "RWA" },
    { name: "Saudi Arabia", iso3: "SAU" },
    { name: "Senegal", iso3: "SEN" },
    { name: "Singapore", iso3: "SGP" },
    { name: "Slovakia", iso3: "SVK" },
    { name: "Slovenia", iso3: "SVN" },
    { name: "South Africa", iso3: "ZAF" },
    { name: "Spain", iso3: "ESP" },
    { name: "Sweden", iso3: "SWE" },
    { name: "Switzerland", iso3: "CHE" },
    { name: "Thailand", iso3: "THA" },
    { name: "Tunisia", iso3: "TUN" },
    { name: "Turkey", iso3: "TUR" },
    { name: "Uganda", iso3: "UGA" },
    { name: "Ukraine", iso3: "UKR" },
    { name: "United Arab Emirates", iso3: "ARE" },
    { name: "United Kingdom", iso3: "GBR" },
    { name: "United States", iso3: "USA" },
    { name: "Uruguay", iso3: "URY" },
    { name: "Viet Nam", iso3: "VNM" }
  ];

function populateCountryDropdown() {
    const countrySelect = document.getElementById("country-select");
    countrySelect.innerHTML = ""; // Clear any existing options
    
    // Create the options for the dropdown
    countries.forEach(country => {
      const option = document.createElement("option");
      option.value = country.iso3;  // Use the ISO 3-letter code as the value
      option.textContent = country.name;  // Display the full country name
      countrySelect.appendChild(option);
    });
}

function updateOptions(options) {
    if (gameModeSelect.value != options[1]){
        gameModeSelect.value = options[1]
        gameModeSelect.dispatchEvent(new Event('change'))
    }
    movingCheck.checked = options[2]
    zoomingCheck.checked = options[3]
    if (timer.checked != options[4]){
        timer.checked = options[4]
        timer.dispatchEvent(new Event('change'))
    }
    
    timerDropdown.value = options[5]
    roundsSelect.value = options[6]
    countrySelect.value = options[7]
}