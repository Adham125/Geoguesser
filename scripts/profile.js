const usernameChangeButton = document.getElementById('username-change-btn')
const passwordChangeButton = document.getElementById('password-change-btn')
const emailChangeButton = document.getElementById('email-change-btn')
const newPasswordInput = document.getElementById('new_password')
const newPasswordOldInput = document.getElementById('confirm_password')
const newUsernameInput = document.getElementById('username')
const confirmPassword = document.getElementById('confirm_password_username')
const newEmailInput = document.getElementById('email')
const confirmPasswordEmail = document.getElementById('confirm_password_email')
const profileTitle = document.getElementById("profileTitle")

const server = 'https://localhost'
const socket = io(server, {
    withCredentials: true
});

document.addEventListener('DOMContentLoaded', () => {
    socket.emit("validateCookie", {}, response => {
        if (response.success){
            profileTitle.innerText = `${response.username}'s Profile Settings`;
        }else{
            profileTitle.innerText = `Guest Profile`;
        }
    })
})

emailChangeButton.addEventListener('click', () => {
    const newEmail = newEmailInput.value;
    const confirmPassword = confirmPasswordEmail.value;

    socket.emit('change_player_details', { detail_type: "email", new: newEmail, oldPassword:confirmPassword }, (response) => {
        
        if (response.success){
            newEmailInput.value = ""
            confirmPasswordEmail.value = ""
        }
        
        alert(response.message)
    });

    window.location.reload();
});

usernameChangeButton.addEventListener('click', () => {
    const username = newUsernameInput.value;
    const confirmPass = confirmPassword.value;

    socket.emit('change_player_details', { detail_type: "username", new: username, oldPassword: confirmPass }, (response) => {
        
        if (response.success){
            newUsernameInput.value = ""
            confirmPassword.value = ""
        }
        
        alert(response.message)
    });

    window.location.reload();
});

passwordChangeButton.addEventListener('click', () => {
    const newPassword = newPasswordInput.value;
    const confirmPassword = newPasswordOldInput.value;

    socket.emit('change_player_details', { detail_type: "password", new: newPassword, oldPassword:confirmPassword }, (response) => {
        
        if (response.success){
            newPasswordInput.value = ""
            newPasswordOldInput.value = ""
        }
        
        alert(response.message)
    });

    window.location.reload();
});

var map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

const iso3ToFullName = {
    AFG: "Afghanistan", ALB: "Albania", DZA: "Algeria", AND: "Andorra", AGO: "Angola", ARG: "Argentina", ARM: "Armenia", AUS: "Australia", AUT: "Austria", AZE: "Azerbaijan",
    BHR: "Bahrain", BGD: "Bangladesh", BRB: "Barbados", BLR: "Belarus", BEL: "Belgium", BLZ: "Belize", BEN: "Benin", BOL: "Bolivia", BIH: "Bosnia and Herzegovina", BWA: "Botswana",
    BRA: "Brazil", BRN: "Brunei", BGR: "Bulgaria", BFA: "Burkina Faso", BDI: "Burundi", KHM: "Cambodia", CMR: "Cameroon", CAN: "Canada", CAF: "Central African Republic", TCD: "Chad",
    CHL: "Chile", CHN: "China", COL: "Colombia", COM: "Comoros", COG: "Congo", CRI: "Costa Rica", HRV: "Croatia", CUB: "Cuba", CYP: "Cyprus", CZE: "Czechia",
    DNK: "Denmark", DJI: "Djibouti", DOM: "Dominican Republic", ECU: "Ecuador", EGY: "Egypt", SLV: "El Salvador", EST: "Estonia", ETH: "Ethiopia", FJI: "Fiji", FIN: "Finland",
    FRA: "France", GAB: "Gabon", GMB: "Gambia", GEO: "Georgia", DEU: "Germany", GHA: "Ghana", GRC: "Greece", GTM: "Guatemala", GIN: "Guinea", HTI: "Haiti",
    HND: "Honduras", HUN: "Hungary", ISL: "Iceland", IND: "India", IDN: "Indonesia", IRN: "Iran", IRQ: "Iraq", IRL: "Ireland", ISR: "Israel", ITA: "Italy",
    JAM: "Jamaica", JPN: "Japan", JOR: "Jordan", KAZ: "Kazakhstan", KEN: "Kenya", KWT: "Kuwait", LAO: "Laos", LVA: "Latvia", LBN: "Lebanon", LSO: "Lesotho",
    LBR: "Liberia", LBY: "Libya", LTU: "Lithuania", LUX: "Luxembourg", MDG: "Madagascar", MWI: "Malawi", MYS: "Malaysia", MDV: "Maldives", MLI: "Mali", MLT: "Malta",
    MEX: "Mexico", MDA: "Moldova", MCO: "Monaco", MNG: "Mongolia", MAR: "Morocco", MOZ: "Mozambique", MMR: "Myanmar", NAM: "Namibia", NPL: "Nepal", NLD: "Netherlands",
    NZL: "New Zealand", NIC: "Nicaragua", NER: "Niger", NGA: "Nigeria", PRK: "North Korea", NOR: "Norway", OMN: "Oman", PAK: "Pakistan", PAN: "Panama", PRY: "Paraguay",
    PER: "Peru", PHL: "Philippines", POL: "Poland", PRT: "Portugal", QAT: "Qatar", ROU: "Romania", RUS: "Russia", RWA: "Rwanda", SAU: "Saudi Arabia", SEN: "Senegal",
    SRB: "Serbia", SGP: "Singapore", SVK: "Slovakia", SVN: "Slovenia", ZAF: "South Africa", KOR: "South Korea", ESP: "Spain", LKA: "Sri Lanka", SDN: "Sudan", SWE: "Sweden",
    CHE: "Switzerland", SYR: "Syria", TWN: "Taiwan", TJK: "Tajikistan", THA: "Thailand", TUN: "Tunisia", TUR: "Turkey", UGA: "Uganda", UKR: "Ukraine", ARE: "United Arab Emirates",
    GBR: "United Kingdom", USA: "United States", URY: "Uruguay", UZB: "Uzbekistan", VEN: "Venezuela", VNM: "Vietnam", YEM: "Yemen", ZMB: "Zambia", ZWE: "Zimbabwe"
};

// Assuming the rounds data is provided directly
var roundsData = await getRoundsData(); 

// Process the rounds data and generate stats
var countryStats = processRoundsData(roundsData);

// Fetch the GeoJSON for the map (no change here)
fetch('../geojson/world-admin-boundaries.geojson')
    .then(response => response.json())
    .then(geojsonData => {
        addGeoJSONLayer(geojsonData, countryStats);
    })
    .catch(error => console.error('Error loading GeoJSON data:', error));

function processRoundsData(roundsData) {
    var countryStats = {};
    Object.entries(roundsData).forEach(([key, round]) => {
        var guessCountryISO = round.guessCountryISO;
        var locationCountryISO = round.locationCountryISO;
        var score = round.score;
        var distance = round.distance;
        var timeTaken = round.timeTaken;
        
        // Initialize country stats if they don't exist
        if (!countryStats[locationCountryISO]) {
            countryStats[locationCountryISO] = {
                totalRounds: 0,
                totalScore: 0,
                totalDistance: 0,
                bestScore: 0,
                totalTime: 0,
                averageTime: 0,
                bestDistance: Infinity,
                mistakeCountries: {}
            };
        }
        
        // Increment total rounds and calculate total score, distance, and time
        countryStats[locationCountryISO].totalRounds++;
        countryStats[locationCountryISO].totalScore += score;
        countryStats[locationCountryISO].totalDistance += distance;
        countryStats[locationCountryISO].totalTime += timeTaken;
        
        // Track best score and best distance
        if (score > countryStats[locationCountryISO].bestScore) {
            countryStats[locationCountryISO].bestScore = score;
        }
        if (distance < countryStats[locationCountryISO].bestDistance) {
            countryStats[locationCountryISO].bestDistance = distance;
        }
        
        // Track mistakes
        if (guessCountryISO !== locationCountryISO && guessCountryISO != "Not Found") {
            if (!countryStats[locationCountryISO].mistakeCountries[guessCountryISO]) {
                countryStats[locationCountryISO].mistakeCountries[guessCountryISO] = 0;
            }
            countryStats[locationCountryISO].mistakeCountries[guessCountryISO]++;
        }
    });

    // Calculate average score and distance, and determine top 3 mistakes
    Object.keys(countryStats).forEach(isoCode => {
        var stats = countryStats[isoCode];
        stats.averageScore = stats.totalScore / stats.totalRounds;
        stats.averageDistance = stats.totalDistance / stats.totalRounds;
        stats.averageTime = stats.totalTime / stats.totalRounds;

        // Sort mistakes and get the top 3
        var sortedMistakes = Object.entries(stats.mistakeCountries)
            .sort((a, b) => b[1] - a[1]) 
            .slice(0, 3)
            .map(([iso, count]) => `${iso3ToFullName[iso] || iso} (${count})`); 
        stats.topMistakes = sortedMistakes.join(', ') || 'None';
    });
    return countryStats;
}

// Placeholder function for fetching rounds data (replace with actual data)
async function getRoundsData() {
    

    const response = await new Promise((resolve, reject) => {
        socket.emit("getUserGameHistory", {}, response => {
            if (response.success){
                resolve(response)
            }
        })
    });
    return response.games
}

function addGeoJSONLayer(geojson, countryStats) {
    L.geoJSON(geojson, {
        style: function(feature) {
            var isoCode = feature.properties.iso3;
            var stats = countryStats[isoCode];
            var averageScore = stats ? stats.averageScore : 0;
            var colour;

            if (averageScore <= 1250) {  // 0 - 1/4 of 5000
                colour = 'rgba(255, 0, 0, 0.7)'; // Red
            } else if (averageScore <= 2500) { // 1/4 - 2/4 of 5000
                colour = 'rgba(255, 140, 0, 0.7)'; // Dark Orange
            } else if (averageScore <= 3750) { // 2/4 - 3/4 of 5000
                colour = 'rgba(255, 255, 0, 0.7)'; // Yellow
            } else { // Above 3/4 of 5000
                colour = 'rgba(0, 255, 0, 0.7)'; // Green
            }

            return {
                colour: '#3388ff',
                weight: 1,
                fillColor: colour,
                fillOpacity: stats ? 0.5 : 0 // Hide fill if no data
            };
        },
        onEachFeature: function(feature, layer) {
            layer.on('click', function() {
                //console.log(feature)
                var isoCode = feature.properties.iso3;
                var stats = countryStats[isoCode];
                var countryName = feature.properties.name;

                // Display the country stats
                if (stats) {
                    showCountryStats(countryName, stats, feature.geometry.coordinates);
                } else {
                    showCountryStats(countryName, { accuracy: 'No data' }, feature.geometry.coordinates);
                }
            });
        }
    }).addTo(map);
}

function showCountryStats(countryName, stats, boundaries) {
    //document.getElementById('map').classList.add('hidden');
    document.getElementById('country-stats').classList.remove('hidden');
    document.getElementById('country-details').innerHTML = `
        <p><strong>${countryName}</strong></p>
        <p>Total Rounds: ${stats.totalRounds}</p>
        <p>Average Score: ${stats.averageScore}</p>
        <p>Average Distance: ${stats.averageDistance}</p>
        <p>Average Time Taken: ${stats.averageTime}</p>
        <p>Best Score: ${stats.bestScore}</p>
        <p>Best Distance: ${stats.bestDistance}</p>
        <p>Top 3 Mistaken Countries: ${stats.topMistakes}</p>
    `;
    
    if (window.currentBoundaryLayer) {
        map.removeLayer(window.currentBoundaryLayer);
    }

    // Check if boundary data is available and draw it
    if (boundaries) {
        window.currentBoundaryLayer = L.geoJSON(boundaries, {
            style: {
                color: 'red',
                weight: 3,
                fillOpacity: 0.2
            }
        }).addTo(map);
    }
}

window.showWorldMap = function() {
    //document.getElementById('map').classList.remove('hidden');
    document.getElementById('country-stats').classList.add('hidden');
}