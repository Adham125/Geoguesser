// Profile page: account settings + per-country stats.
//
// Three editable sections:
//   1. Display Identity (username + colour) → `updatePlayerDetails` (session auth)
//   2. Email (requires current password)
//   3. Password (requires current password)

import { serverURL as server } from './config.js';
import { showMessage, showToast, showConfirm } from './popup.js';

const displayUsernameInput   = document.getElementById('display-username');
const displayColourInput     = document.getElementById('display-colour-input');
const displaySwatchVisible   = document.getElementById('display-swatch-visible');
const displayIdentityButton  = document.getElementById('display-identity-btn');

const passwordChangeButton   = document.getElementById('password-change-btn');
const emailChangeButton      = document.getElementById('email-change-btn');
const newPasswordInput       = document.getElementById('new_password');
const newPasswordOldInput    = document.getElementById('confirm_password');
const newEmailInput          = document.getElementById('email');
const confirmPasswordEmail   = document.getElementById('confirm_password_email');
const profileTitle           = document.getElementById('profileTitle');

const socket = io(server, { withCredentials: true });

// Pull current identity on load: title uses the session's username, and the
// Display Identity inputs are pre-populated from the stored profile details.
document.addEventListener('DOMContentLoaded', () => {
    socket.emit("validateCookie", {}, (response) => {
        if (response && response.success) {
            profileTitle.innerText = `${response.username}'s Profile`;
        } else {
            profileTitle.innerText = 'Guest Profile';
            document.querySelectorAll('.profile-section').forEach(s => s.remove());
            const subtitle = document.querySelector('.profile-subtitle');
            if (subtitle) subtitle.remove();
            const msg = document.createElement('p');
            msg.className = 'profile-subtitle';
            msg.style.cssText = 'margin-top: var(--space-4);';
            msg.innerHTML = "You're browsing as a guest. Sign in to manage your profile and see your stats. <a class=\"btn btn--primary\" href=\"../index.html\">Sign in</a>";
            profileTitle.insertAdjacentElement('afterend', msg);
        }
    });
    socket.emit("checkPlayerDetails", {}, (response) => {
        if (!response) return;
        if (response.success) {
            if (response.username) displayUsernameInput.value = response.username;
            if (response.colour) {
                displayColourInput.value = response.colour;
                if (displaySwatchVisible) displaySwatchVisible.style.backgroundColor = response.colour;
            }
        } else if (response.details) {
            // Partial details (only name or colour set) — populate what's there.
            if (response.details.username) displayUsernameInput.value = response.details.username;
            if (response.details.colour) {
                displayColourInput.value = response.details.colour;
                if (displaySwatchVisible) displaySwatchVisible.style.backgroundColor = response.details.colour;
            }
        }
    });
});

// ---- Display Identity (no password required — just session auth) ----
displayIdentityButton.addEventListener('click', () => {
    const name = displayUsernameInput.value.trim();
    const colour = displayColourInput.value;
    if (!name) {
        showMessage('Please enter a display name.', { title: 'Missing name' });
        return;
    }
    socket.emit('updatePlayerDetails', { name, colour }, (response) => {
        if (response && response.success) {
            // Reflect the new identity in localStorage so the next lobby/game
            // we join uses it without requiring a re-sign-in.
            localStorage.setItem('playerName', name);
            localStorage.setItem('playerColour', colour);
            showMessage('Identity updated.', { title: 'Saved' });
        } else {
            showMessage('Could not update identity.', { title: 'Error' });
        }
    });
});

// ---- Email change ----
emailChangeButton.addEventListener('click', () => {
    const newEmail = newEmailInput.value;
    const confirmPassword = confirmPasswordEmail.value;

    socket.emit('change_player_details', { detail_type: "email", new: newEmail, oldPassword: confirmPassword }, (response) => {
        if (response.success) {
            newEmailInput.value = "";
            confirmPasswordEmail.value = "";
            showToast("Email updated.", { type: "success" });
        } else {
            showToast(response?.message || "Couldn't update email.", { type: "error" });
        }
    });
});

// ---- Password change ----
passwordChangeButton.addEventListener('click', () => {
    const newPassword = newPasswordInput.value;
    const confirmPassword = newPasswordOldInput.value;

    socket.emit('change_player_details', { detail_type: "password", new: newPassword, oldPassword: confirmPassword }, (response) => {
        if (response.success) {
            newPasswordInput.value = "";
            newPasswordOldInput.value = "";
            showToast("Password updated.", { type: "success" });
        } else {
            showToast(response?.message || "Couldn't update password.", { type: "error" });
        }
    });
});

// ---- Delete account (permanent, confirmation-gated) ----
const deleteAccountButton = document.getElementById('delete-account-btn');
if (deleteAccountButton) {
    deleteAccountButton.addEventListener('click', async () => {
        const ok = await showConfirm(
            "This permanently deletes your account and all your stats. This can't be undone.",
            { title: "Delete account?", okText: "Delete account", cancelText: "Cancel", danger: true }
        );
        if (!ok) return;
        deleteAccountButton.classList.add('is-pending');
        deleteAccountButton.disabled = true;
        socket.emit('deleteAccount', {}, (response) => {
            if (response && response.success) {
                window.location.href = '../index.html';
            } else {
                showToast(response?.message || "Couldn't delete your account. Try again.", { type: "error" });
                deleteAccountButton.classList.remove('is-pending');
                deleteAccountButton.disabled = false;
            }
        });
    });
}

// ---- Stats map ----
var map = L.map('map').setView([20, 0], 2);
// Dark tile set to match the site's dark-mode design.
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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

// Empty state: no games recorded yet
if (Object.keys(countryStats).length === 0) {
    const detailsEl = document.getElementById('country-details');
    const statsEl = document.getElementById('country-stats');
    if (detailsEl) detailsEl.innerHTML = '<p>No games recorded yet — play a round to see your stats here.</p>';
    if (statsEl) {
        statsEl.classList.remove('hidden');
        const closeBtn = statsEl.querySelector('.close-btn');
        if (closeBtn) closeBtn.style.display = 'none';
    }
}

// Populate keyboard-accessible country picker
const statsPicker = document.getElementById('country-stats-picker');
if (statsPicker && Object.keys(countryStats).length > 0) {
    Object.keys(countryStats)
        .sort((a, b) => (iso3ToFullName[a] || a).localeCompare(iso3ToFullName[b] || b))
        .forEach(iso => {
            const opt = document.createElement('option');
            opt.value = iso;
            opt.textContent = iso3ToFullName[iso] || iso;
            statsPicker.appendChild(opt);
        });
    statsPicker.addEventListener('change', () => {
        const iso = statsPicker.value;
        if (!iso) return;
        showCountryStats(iso3ToFullName[iso] || iso, countryStats[iso], null);
    });
}

// Fetch the GeoJSON for the map (no change here)
fetch('../geojson/world-admin-boundaries-new.geojson')
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
    const response = await new Promise((resolve) => {
        socket.emit("getUserGameHistory", {}, response => {
            if (response.success) resolve(response);
            else resolve({ games: {} });
        });
    });
    return response.games;
}

function addGeoJSONLayer(geojson, countryStats) {
    L.geoJSON(geojson, {
        style: function(feature) {
            var isoCode = feature.properties.color_code;
            var stats = countryStats[isoCode];
            var averageScore = stats ? stats.averageScore : 0;
            var colour;

            if (averageScore <= 1250) {
                colour = 'rgba(220, 38, 38, 0.7)';  // red
            } else if (averageScore <= 2500) {
                colour = 'rgba(245, 158, 11, 0.7)'; // amber
            } else if (averageScore <= 3750) {
                colour = 'rgba(234, 179, 8, 0.7)';  // yellow
            } else {
                colour = 'rgba(16, 185, 129, 0.7)'; // green
            }

            return {
                color: '#64748B',
                weight: 1,
                fillColor: colour,
                fillOpacity: stats ? 0.55 : 0
            };
        },
        onEachFeature: function(feature, layer) {
            layer.on('click', function() {
                var isoCode = feature.properties.color_code;
                var stats = countryStats[isoCode];
                var countryName = feature.properties.name;

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
    document.getElementById('country-stats').classList.remove('hidden');

    // Built with textContent, not innerHTML. `topMistakes` is derived from
    // guessCountryISO values that came off the wire and were persisted to the
    // player's own game history — an ISO code that isn't one (say, an <img
    // onerror=…>) rendered as markup here. The server validates the code on
    // the way in now; this is the matching fix on the way out, and it covers
    // rows already stored under the old rules.
    const rows = [
        [null, countryName],
        ['Total Rounds', stats.totalRounds ?? '—'],
        ['Average Score', stats.averageScore !== undefined ? Math.round(stats.averageScore) : '—'],
        ['Average Distance', stats.averageDistance !== undefined ? Math.round(stats.averageDistance) + ' km' : '—'],
        ['Average Time', stats.averageTime !== undefined ? Math.round(stats.averageTime) + ' s' : '—'],
        ['Best Score', stats.bestScore ?? '—'],
        ['Best Distance', stats.bestDistance !== undefined && stats.bestDistance !== Infinity ? Math.round(stats.bestDistance) + ' km' : '—'],
        ['Top 3 Mistaken Countries', stats.topMistakes ?? '—'],
    ];
    const details = document.getElementById('country-details');
    details.textContent = '';
    for (const [label, value] of rows) {
        const p = document.createElement('p');
        if (label === null) {
            const strong = document.createElement('strong');
            strong.textContent = String(value);
            p.appendChild(strong);
        } else {
            p.textContent = `${label}: ${value}`;
        }
        details.appendChild(p);
    }

    if (window.currentBoundaryLayer) {
        map.removeLayer(window.currentBoundaryLayer);
    }

    if (boundaries) {
        window.currentBoundaryLayer = L.geoJSON(boundaries, {
            style: {
                color: '#F59E0B',
                weight: 3,
                fillOpacity: 0.2
            }
        }).addTo(map);
    }
}

window.showWorldMap = function() {
    document.getElementById('country-stats').classList.add('hidden');
}
