import { pickRandomPoint } from './geojson.js';
import { serverURL as server } from './config.js';
import { showMessage, showConfirm } from './popup.js';
import { attachConnectionBanner } from './connection.js';

const geojsonFilePath = '../geojson/world.geojson';
var map;
var clickListener;
const mapcss = document.getElementById("map");
const panocss = document.getElementById("pano");
var streetView;
var streetViewId;
var markers = [];
var markerISOs = []
var locationISO;
var polyLine;
var location = null;

const confirmButton = document.getElementById("Confirm");
const nextButton = document.getElementById("Next");
const closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click", closeScoresMenu);
const startPosButton = document.getElementById("Start_Location");
  startPosButton.addEventListener("click", returnToStart)
// replayButton is now a plain <a href="./lobby.html"> — same flow as H&S:
// each player independently navigates back to the lobby, and a new game
// starts from Start Game there (server resets rounds on startGame).
const endGameButton = document.getElementById("EndGame");
  endGameButton.addEventListener("click", async () => {
    if (!hosting || roomName === "Singleplayer") return;
    const ok = await showConfirm("End the game now and show final scores?", {
      title: "End Game", okText: "End Game", danger: true
    });
    if (ok) socket.emit("endGame", roomName);
  });
const timer = document.getElementById("timer");

confirmButton.addEventListener("click", async function(event) {
  event.preventDefault();
  await confirmSelect(false);
});
nextButton.addEventListener("click", nextRound);


var roundsMax = JSON.parse(localStorage.getItem("rounds"));
var currentRound = 1;
var scoresMenu = document.getElementById("scoresMenu");
var scoresList = document.getElementById("scoresList");

var ongoingScore = 0;
var distance;

var gamemode = JSON.parse(localStorage.getItem("gameMode"));
var polygon;

var options = JSON.parse(localStorage.getItem("gameOptions"));
var totalSeconds = JSON.parse(localStorage.getItem("timer"))
var timerInterval;
var startTime;
var ongoingScoreElement = document.getElementById('player-scores');

const socket = io(server, {
  withCredentials: true
});
attachConnectionBanner(socket);

socket.emit("loadAPIKeyMaps", (callback) => {
  let key = callback.key

  const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker&callback=initialize&v=weekly`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
})

var roomName = JSON.parse(localStorage.getItem("roomCode"))
var hosting = JSON.parse(localStorage.getItem("roomHost"))
var playerName = localStorage.getItem("playerName");
var playerColour = localStorage.getItem("playerColour");

if (!options || !gamemode || roomName == null) {
  // Arrived without game setup (deep link / back-nav after localStorage.clear()).
  // Redirect back to the landing page instead of throwing on options.timer.
  window.location.href = "./main.html";
}

var playerScoreMap = {}
// Current host socket id — kept in sync via `hostChanged` so mid-game host
// changes (original host left, transfer) flip host-only UI automatically.
var currentHostId = null;
var lastPlayers = {};

if (options.timer) {
  resetTimer()
}else{
  timer.style.display = "none"
}

if (hosting && roomName != "Singleplayer") {
  endGameButton.style.display = "inline-block";
}

socket.emit("joinedGame", [roomName, playerName, playerColour])

socket.on("playerJoined", players => { // vars = players {name, colour}
  lastPlayers = players || {};
  ongoingScoreElement.innerHTML = ''; // Clear existing scores
  for (const player in players) {
    const scoreDiv = document.createElement('div');
    scoreDiv.classList.add('score-div');
    scoreDiv.dataset.sid = player;

    const playerNameSpan = document.createElement('span');
    playerNameSpan.classList.add('player-name');
    playerNameSpan.style.color = players[player].colour; // Color for the name
    playerNameSpan.textContent = `${players[player].name}: `

    const scoreSpan = document.createElement('span'); // Span for the score
    scoreSpan.classList.add('score');
    scoreSpan.textContent = "0"

    const checkmarkDiv = document.createElement('div'); // New div for checkmark
    checkmarkDiv.classList.add('checkmark-div'); // Add a class for styling

    const checkmarkImg = document.createElement('img');
    checkmarkImg.src = '../imgs/checkMark.png'; // Path to your checkmark image
    checkmarkImg.alt = 'Checkmark';
    checkmarkImg.style.width = '20px'; // Adjust size as needed
    checkmarkImg.style.height = '20px';
    checkmarkDiv.appendChild(checkmarkImg);
    checkmarkDiv.style.display = 'none'; // Initially hidden

    scoreDiv.appendChild(playerNameSpan);
    scoreDiv.appendChild(scoreSpan);
    scoreDiv.appendChild(checkmarkDiv);
    ongoingScoreElement.appendChild(scoreDiv);
    playerScoreMap[player] = [scoreSpan, false, checkmarkDiv]
  }
})

// When a player disconnects mid-game, drop their row from the scoreboard
// and release their playerScoreMap entry so stale DOM doesn't linger.
socket.on("playerLeft", ({ socketId, players }) => {
  if (players) lastPlayers = players;
  if (!socketId) return;
  const row = ongoingScoreElement.querySelector(`.score-div[data-sid="${socketId}"]`);
  if (row) row.remove();
  delete playerScoreMap[socketId];
});

socket.on("hostChanged", ({ hostId }) => {
  currentHostId = hostId;
  hosting = hostId === socket.id;
  localStorage.setItem("roomHost", hosting ? "true" : "false");
  if (hosting && roomName !== "Singleplayer") {
    endGameButton.style.display = "inline-block";
  } else {
    endGameButton.style.display = "none";
  }
});

socket.on("kicked", async ({ reason } = {}) => {
  await showMessage(reason || "You were removed from the room by the host.", {
    title: "Removed from room"
  });
  window.location.href = './main.html';
});

socket.on("roomStartLocation", panoId => {
  // Only the pano id is broadcast at round start. location, polygon, and
  // locationISO stay on the server and are returned to each player via the
  // `guessed` ack — after they've committed their guess.
  if (!hosting){
    streetViewId = panoId;
    initialize(streetViewId);
  }
})

socket.on("initNextRound", function() {
  hideRoundResult();

  for (const player in playerScoreMap){   // Remove all check marks
    playerScoreMap[player][2].style.display = 'none'
  }

  if (hosting){
    initialize()
  }else{
    currentRound++;
    confirmButton.disabled = false;
    markers = [];
    markerISOs = [];
    if (options.timer) {
      resetTimer();
    }
    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");
    // Wait for CSS transition to finish, then trigger map resize
    setTimeout(() => { if (map) google.maps.event.trigger(map, 'resize'); }, 550);
  }
})

socket.on("playerGuessed", player => {
  //TODO: player guess notification ("guess" next to current score)
  playerScoreMap[player][2].style.display = 'block'
});

socket.on("drawGuess", vars => { // vars = resultsParsed[`round${round}`]
  let results = vars

  for (const player in results) {
    if (player === socket.id){

    }else if (results[player].guess){
      polyLine = new google.maps.Polyline({
        path: [results[player].guess, results[player].location],
        geodesic: true,
        strokeColor: results[player].colour,
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
      });
      placeMarker(results[player].guess, results[player].colour);

    }
    // Update ongoing scoreboard
    if (!playerScoreMap[player][1]) {
      playerScoreMap[player][0].textContent = parseInt(playerScoreMap[player][0].textContent) + results[player].score
      playerScoreMap[player][1] = true
    }
  }
})

socket.on("roundEnded", function() {
  if(hosting){
    nextButton.disabled = false;
  }

  for (const player in playerScoreMap){
    playerScoreMap[player][1] = false
  }
  
})

socket.on("endOfGameResults", results => {
  populateMultiplayerScores(results)
})

async function initialize(id = null) {
  //const fenway = { lat: 42.345573, lng: -71.098326 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    disableDefaultUI: true,
    gestureHandling: "greedy",
    mapId: "1b65baa89de7a1e3",
  });
  map.setOptions({ clickableIcons: false });
  map.data.loadGeoJson("../geojson/world-admin-boundaries-new.geojson")
  map.data.setStyle({
    fillColor: "white",
    strokeWeight: 1,
    strokeOpacity: 0,
    fillOpacity: 0,
  });

  // Trigger resize after CSS transition to prevent blank map
  google.maps.event.addListenerOnce(map, 'idle', () => {
    setTimeout(() => { google.maps.event.trigger(map, 'resize'); }, 550);
  });

  if (roomName === "Singleplayer"){
    if(ongoingScoreElement.children.length === 0){
      const scoreDiv = document.createElement('div');

      const playerNameSpan = document.createElement('span');
      playerNameSpan.classList.add('player-name');
      playerNameSpan.textContent = "Score: "

      const scoreSpan = document.createElement('span'); // Span for the score
      scoreSpan.classList.add('score');
      scoreSpan.textContent = "0"

      scoreDiv.appendChild(playerNameSpan);
      scoreDiv.appendChild(scoreSpan);
      ongoingScoreElement.appendChild(scoreDiv);
    }
    

    clickListener = map.data.addListener("click", (e) => { //feature, Fg, iso3/name
      setMapOnAll(null);
      placeMarker(e.latLng);
      markerISOs.push(e.feature.getProperty('iso3'))
    });
  }else{
    clickListener = map.data.addListener("click", (e) => {
      setMapOnAll(null);
      placeMarker(e.latLng, playerColour);
      markerISOs.push(e.feature.getProperty('iso3'))
    });
  }
  

  nextButton.disabled = true;

  if (roomName === "Singleplayer"){         // <----------------- Singleplayer
    await getStreetView ()
  }else{                  // <------------------- Multiplayer
    if (hosting){     // Host actions
      await getStreetView()
      socket.emit("initialize", [roomName, location, polygon, streetViewId, locationISO])
    }
  }

  if(id != null){      // Other players actions
    await getStreetView(id)
  }

  startTime = Date.now()
}

function placeMarker(latLng, colour = "#FF6347") {
  let markerNew;
  if (colour === "flag"){
    const img = document.createElement("img");
    img.src = "../imgs/red-flag.png";
    img.style.width = "60px"; 
    img.style.height = "40px"; 
    img.style.pointerEvents = "none"; 

    markerNew = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map: map, 
      content: img,
    });
  }else if(colour === "#FF6347") {   // Default
    markerNew = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map: map, 
      content: new google.maps.marker.PinElement({background: "#FF6347",}).element,
    });
  }else{
    markerNew = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map: map, 
      content: new google.maps.marker.PinElement({background: colour,}).element,
    });
  }
  markers.push(markerNew);
}

function setMapOnAll(map) {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function updateTimer() {
  if (totalSeconds <= 0) {            // End of timer logic
    clearInterval(timerInterval);
    confirmSelect(true);
    return;
  }

  totalSeconds--; // Decrease the timer by 1 second

  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  // Format the time as MM:SS
  let formattedTime = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  timer.textContent = formattedTime;

  // HUD color state — amber at ≤30s, red+pulse at ≤10s.
  timer.classList.toggle("critical", totalSeconds <= 10);
  timer.classList.toggle("warning", totalSeconds > 10 && totalSeconds <= 30);
}

function resetTimer () {
  totalSeconds = JSON.parse(localStorage.getItem("timer"))
  timerInterval = setInterval(updateTimer, 1000);
  timer.classList.remove("warning", "critical");
  timer.style.display = 'block';
}

async function getStreetView (id = null) {             //<------------------ Main
  var source;
  var pref;
  var countryISO = null;
  if(gamemode === "classic"){
      source = [google.maps.StreetViewSource.GOOGLE];
      pref = google.maps.StreetViewPreference.BEST;
  }else if (gamemode === "countrySelect"){
    source = [google.maps.StreetViewSource.GOOGLE];
    pref = google.maps.StreetViewPreference.BEST;
    countryISO = JSON.parse(localStorage.getItem("selectedCountry"))
  }

  const streetViewService = new google.maps.StreetViewService();

  while (true) {          // Get StreetView location Section
    if (id == null){      // Host Initilization
      try {
        var randomPoint
        let temp = await pickRandomPoint(countryISO); // Get a random point
        locationISO = temp[1]
        polygon = temp[2]
        temp = temp[0]
        randomPoint = new google.maps.LatLng({lat: temp.geometry.coordinates[1], lng: temp.geometry.coordinates[0]});
        location = randomPoint
      } catch (error) {
        console.error('Error:', error.message);
      }

      const request = {
        location: location,
        preference: pref,
        radius: Number(1000),          // <---------- SEARCH RADIUS
        sources: source,
      };

      const sv = await streetViewService.getPanorama(request, (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data?.location) {
            streetView = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
              pov: { heading: 0, pitch: 0 },
              disableDefaultUI: true,
              showRoadLabels: false,
              scrollwheel : options.zooming, 
              clickToGo: options.moving,
          });
          streetViewId = data.location.pano
          streetView.setPano(data.location.pano);
          location = data.location.latLng;
        }
      });
      if (sv !== undefined) {
        break;
      } 
    }else{
      streetView = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
        pov: { heading: 0, pitch: 0 },
        disableDefaultUI: true,
        showRoadLabels: false,
        scrollwheel : options.zooming, 
        clickToGo: options.moving,
      });
      streetView.setPano(id);
      break
    }
    
    document.getElementById('loading-spinner').style.display = 'block';  // Show spinner
    panocss.classList.add('is-loading');
  }
  document.getElementById('loading-spinner').style.display = 'none';
  panocss.classList.remove('is-loading');
  streetView.addListener("pov_changed", () => {
    const heading = streetView.getPov().heading; // Get the current heading in degrees
    const compassImage = document.getElementById("compass-image");
    compassImage.style.transform = `rotate(${heading}deg)`;  // Rotate the compass based on heading
  });
}

const countryNameCache = {};
async function getCountryName(iso) {
  if (!iso) return null;
  if (iso in countryNameCache) return countryNameCache[iso];
  try {
    const res = await fetch(`../geojson/${iso}.geojson`);
    if (!res.ok) { countryNameCache[iso] = null; return null; }
    const data = await res.json();
    const name = (data.properties && data.properties.NAME) ? data.properties.NAME : null;
    countryNameCache[iso] = name;
    return name;
  } catch (_) {
    countryNameCache[iso] = null;
    return null;
  }
}

function plonkitUrl(countryName) {
  const slug = countryName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://www.plonkit.net/${slug}`;
}

async function showRoundResult(score, distance, iso, guessISO) {
  const panel = document.getElementById("roundResult");
  const scoreEl = document.getElementById("round-result-score");
  const distanceEl = document.getElementById("round-result-distance");
  const countryEl = document.getElementById("round-result-country");
  const plonkitEl = document.getElementById("round-result-plonkit");

  scoreEl.textContent = `${Number(score).toLocaleString()} pts`;
  distanceEl.textContent = distance !== null
    ? `${Number(distance).toLocaleString()} km from target`
    : "Time ran out — no guess submitted";

  const name = await getCountryName(iso);
  if (name) {
    countryEl.textContent = `Country: ${name}`;
    countryEl.style.display = 'block';
  } else {
    countryEl.style.display = 'none';
  }

  // Show plonkit link when the user guessed the wrong country or scored below 1000
  const wrongCountry = guessISO && iso && guessISO !== iso;
  if ((wrongCountry || score < 1000) && name) {
    plonkitEl.href = plonkitUrl(name);
    plonkitEl.textContent = `Brush up on ${name} on plonkit.net \u2197`;
    plonkitEl.style.display = 'inline-block';
  } else {
    plonkitEl.style.display = 'none';
  }

  panel.classList.remove('hidden');
  panel.classList.add('visible');
}

function hideRoundResult() {
  const panel = document.getElementById("roundResult");
  panel.classList.remove('visible');
  panel.classList.add('hidden');
}

async function populateMultiplayerScores(scores = null) {
  let players;
  google.maps.event.removeListener(clickListener);
  // Force full-screen map + fully-hidden pano, regardless of whether this
  // was reached via the normal end-of-game flow (map already swapped) or
  // the host's End Game button pressed mid-round.
  if (!mapcss.classList.contains("swapped")) mapcss.classList.add("swapped");
  if (!panocss.classList.contains("swapped")) panocss.classList.add("swapped");
  panocss.classList.add("hidden");
  hideRoundResult();
  markers = [];
  nextButton.disabled = true;
  const allCoords = [];
  let dataAll;

  if (scores == null) {
    dataAll = JSON.parse(localStorage.getItem("roundsResults"));
  } else {
    players = scores.players;
    dataAll = JSON.parse(scores.rounds);
  }

  scoresList.innerHTML = "";
  const winnerBanner = document.getElementById("scoresWinner");
  if (winnerBanner) winnerBanner.innerHTML = "";

  // Pre-fetch country names for all rounds
  const isoSet = new Set();
  for (let i = 1; i <= roundsMax; i++) {
    const rd = dataAll && dataAll[`round${i}`];
    if (!rd) continue;
    if (roomName === "Singleplayer") {
      if (rd.locationISO) isoSet.add(rd.locationISO);
    } else {
      for (const sid in rd) {
        if (rd[sid] && rd[sid].locationISO) { isoSet.add(rd[sid].locationISO); break; }
      }
    }
  }
  const countryNameByIso = {};
  await Promise.all([...isoSet].map(async iso => {
    countryNameByIso[iso] = await getCountryName(iso);
  }));

  if (roomName != "Singleplayer") {
    // Collect player IDs and totals
    const playerTotals = {};
    const playerIds = [];
    for (let i = 1; i <= roundsMax; i++) {
      const rd = dataAll[`round${i}`];
      if (!rd) continue;
      for (const sid in rd) {
        if (!(sid in playerTotals)) { playerTotals[sid] = 0; playerIds.push(sid); }
        playerTotals[sid] += (rd[sid].score || 0);
      }
    }

    // Build table
    const table = document.createElement("table");
    table.className = "scores-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.innerHTML = "<th>Round</th><th>Country</th>";
    playerIds.forEach(sid => {
      const name = sid === socket.id ? "You" : (players && players[sid] ? players[sid].name : sid);
      const colour = (players && players[sid] && players[sid].colour) ? players[sid].colour : "#333";
      const th = document.createElement("th");
      th.textContent = name;
      th.style.color = colour;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 1; i <= roundsMax; i++) {
      const rd = dataAll[`round${i}`];
      if (!rd) continue;
      const tr = document.createElement("tr");

      const roundCell = document.createElement("td");
      roundCell.textContent = `R${i}`;
      tr.appendChild(roundCell);

      const iso = playerIds.map(p => rd[p] && rd[p].locationISO).find(Boolean) || null;
      const cname = iso ? countryNameByIso[iso] : null;
      const countryCell = document.createElement("td");
      countryCell.className = "country-cell";
      countryCell.textContent = cname || "\u2014";
      const myEntry = rd[socket.id];
      const mpWrongCountry = myEntry && myEntry.guessISO && iso && myEntry.guessISO !== iso;
      if (myEntry && (mpWrongCountry || myEntry.score < 1000) && cname) {
        const link = document.createElement("a");
        link.className = "plonkit-link";
        link.href = plonkitUrl(cname);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "study";
        countryCell.appendChild(document.createTextNode(" "));
        countryCell.appendChild(link);
      }
      tr.appendChild(countryCell);

      playerIds.forEach(sid => {
        const td = document.createElement("td");
        const entry = rd[sid];
        td.textContent = entry ? Number(entry.score || 0).toLocaleString() : "\u2014";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);

      // Map rendering
      playerIds.forEach(sid => {
        const entry = rd[sid];
        if (!entry) return;
        const colour = sid === socket.id ? playerColour : entry.colour;
        if (entry.guess) {
          placeMarker(entry.guess, colour);
          allCoords.push(entry.guess);
          if (entry.location) {
            new google.maps.Polyline({
              path: [entry.guess, entry.location],
              geodesic: true,
              strokeColor: colour,
              strokeOpacity: 1.0,
              strokeWeight: 2,
              map: map
            });
          }
        }
        if (entry.location && sid === socket.id) {
          placeMarker(entry.location, "flag");
          allCoords.push(entry.location);
        }
      });
    }

    // Totals row
    const sortedByTotal = playerIds.slice().sort((a, b) => playerTotals[b] - playerTotals[a]);
    const winnerId = sortedByTotal[0];
    const totalsRow = document.createElement("tr");
    totalsRow.className = winnerId && winnerId === socket.id ? "totals-row winner" : "totals-row";
    totalsRow.innerHTML = "<td colspan=\"2\">Total</td>";
    playerIds.forEach(sid => {
      const td = document.createElement("td");
      td.textContent = (playerTotals[sid] || 0).toLocaleString();
      if (sid === winnerId) td.style.fontWeight = "800";
      totalsRow.appendChild(td);
    });
    tbody.appendChild(totalsRow);

    table.appendChild(tbody);
    scoresList.appendChild(table);

    if (winnerBanner && winnerId) {
      const wname = winnerId === socket.id ? "You" : (players && players[winnerId] ? players[winnerId].name : winnerId);
      winnerBanner.innerHTML = `
        <svg class="trophy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="22" height="22">
          <path fill="currentColor" d="M6 3h12v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5 6 6 0 0 1-4 2.91V19h3a1 1 0 0 1 1 1v1H7v-1a1 1 0 0 1 1-1h3v-3.09A6 6 0 0 1 7 13a5 5 0 0 1-5-5V6a1 1 0 0 1 1-1h3V3Zm0 4H4v1a3 3 0 0 0 2 2.83V7Zm12 0v3.83A3 3 0 0 0 20 8V7h-2Z"/>
        </svg>
        <span>${wname} — ${(playerTotals[winnerId] || 0).toLocaleString()} pts</span>
      `;
    }
  } else {
    // Singleplayer list
    const list = document.createElement("ul");
    list.className = "scores-list-sp";
    let total = 0;
    for (let i = 1; i <= roundsMax; i++) {
      const data = dataAll[`round${i}`];
      if (!data) continue;
      total += (data.score || 0);
      const iso = data.locationISO || null;
      const cname = iso ? countryNameByIso[iso] : null;

      const li = document.createElement("li");

      const meta = document.createElement("span");
      meta.className = "round-meta";
      const distStr = (data.distance != null) ? `${Number(data.distance).toLocaleString()} km` : "no guess";
      meta.textContent = `Round ${i} \u2014 ${cname || "Unknown"} \u00b7 ${distStr}`;

      const sc = document.createElement("span");
      sc.className = "round-score";
      sc.textContent = `${Number(data.score || 0).toLocaleString()} pts`;

      li.appendChild(meta);
      li.appendChild(sc);

      const spWrongCountry = data.guessISO && data.locationISO && data.guessISO !== data.locationISO;
      if ((spWrongCountry || (data.score || 0) < 1000) && cname) {
        const link = document.createElement("a");
        link.className = "plonkit-link";
        link.href = plonkitUrl(cname);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `study ${cname} \u2197`;
        li.appendChild(link);
      }

      list.appendChild(li);

      if (data.location) {
        placeMarker(data.location, "flag");
        allCoords.push(data.location);
      }
      if (data.guess) {
        placeMarker(data.guess);
        allCoords.push(data.guess);
        if (data.location) {
          const pl = new google.maps.Polyline({
            path: [data.guess, data.location],
            geodesic: true,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 2
          });
          pl.setMap(map);
        }
      }
    }
    scoresList.appendChild(list);
    if (winnerBanner) {
      winnerBanner.textContent = `Total: ${total.toLocaleString()} pts`;
    }
  }

  if (allCoords.length > 0) {
    const bounds = calculateLatLngBounds(allCoords);
    map.fitBounds(bounds);
  }

  const replayBtn = document.getElementById("replayButton");
  if (replayBtn) {
    // Everyone (not just host) sees Play Again; Singleplayer has no lobby
    // to return to, so hide it there — the Home button covers that case.
    replayBtn.style.display = (roomName != "Singleplayer") ? "inline-block" : "none";
  }

  endGameButton.style.display = "none";

  scoresMenu.classList.remove("hidden");
  scoresMenu.classList.add("visible");
}

function nextRound() {
  hideRoundResult();
  currentRound++;
  if (currentRound > roundsMax){         // End of Game Logic
    if(roomName === "Singleplayer"){
      populateMultiplayerScores();
    }else{
      socket.emit("endGame", roomName)
    }
  }else{                              // Next Round Logic
    confirmButton.disabled = false;
    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");
    markers = []
    if (options.timer) {
      resetTimer()
    }

    if(roomName === "Singleplayer"){
      // Delay initialize until CSS swap transition completes to prevent blank map
      setTimeout(() => { initialize(); }, 550);
    }else{
      socket.emit("startNextRound", roomName)
    }
  }
}

async function confirmSelect(timedOut) {
  if (markers.length === 0 && !timedOut) {
    showMessage("You need to select a location first!");
    return;
  }

  let elapsedTime = (Date.now() - startTime) / 1000;

  clearInterval(timerInterval)
  timer.style.display = 'none';

  const hasGuess = markers.length > 0;
  let score;
  const guessPosition = hasGuess ? markers[markers.length - 1].position : null;
  const guessISO = markerISOs.length > 0 ? markerISOs[markerISOs.length - 1] : null;

  mapcss.classList.toggle("swapped");
  panocss.classList.toggle("swapped");

  confirmButton.disabled = true;

  if (roomName === "Singleplayer"){
    if (hasGuess && !timedOut) {
      const pointsReturn = await calculatePoints();
      score = Math.floor(pointsReturn[0]);
      distance = Math.floor(pointsReturn[1]);
    } else {
      score = 0;
      distance = null;
    }

    placeMarker(location, "flag");

    ongoingScoreElement.innerHTML = '';
    ongoingScore = ongoingScore + score;

    const scoreDiv = document.createElement('div');
    scoreDiv.textContent = `Score: ${ongoingScore}`;
    ongoingScoreElement.appendChild(scoreDiv);

    nextButton.disabled = false;
    if (guessPosition) {
      polyLine = new google.maps.Polyline({
        path: [location, guessPosition],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2
      });
      polyLine.setMap(map);
    }

    socket.emit("singleplayerGuess", [guessPosition, currentRound, location, score, distance, elapsedTime, gamemode, guessISO, locationISO])
  }else{
    // Multiplayer: the real location is not known client-side until the server
    // acks this emit. Send only the guess payload, then receive location,
    // polygon, locationISO, score, and distance from the server. Guard the
    // ack with a timeout+disconnect race so a dropped socket can't hang the
    // round indefinitely.
    const ack = await new Promise(resolve => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        socket.off("disconnect", onDisconnect);
        clearTimeout(timeoutHandle);
        resolve(value);
      };
      const onDisconnect = () => settle(null);
      const timeoutHandle = setTimeout(() => settle(null), 15000);
      socket.once("disconnect", onDisconnect);
      socket.emit("guessed",
        [roomName, guessPosition, currentRound, playerColour, elapsedTime, gamemode, guessISO],
        settle
      );
    })
    if (ack) {
      if (ack.location) location = new google.maps.LatLng({lat: ack.location.lat, lng: ack.location.lng});
      if (ack.polygon) polygon = ack.polygon;
      if (ack.locationISO) locationISO = ack.locationISO;
      score = (typeof ack.score === "number") ? ack.score : 0;
      distance = (typeof ack.distance === "number") ? ack.distance : null;
    } else {
      score = 0;
      distance = null;
    }

    placeMarker(location, "flag");
    if (guessPosition) {
      polyLine = new google.maps.Polyline({
        path: [location, guessPosition],
        geodesic: true,
        strokeColor: playerColour,
        strokeOpacity: 1.0,
        strokeWeight: 2
      });
      polyLine.setMap(map);
    }
  }

  google.maps.event.removeListener(clickListener);

  let results = localStorage.getItem("roundsResults")
  let resultsParsed = {};
  if (results){
    resultsParsed = JSON.parse(results)
  }

  resultsParsed[`round${currentRound}`] = {
    "guess": guessPosition,
    "location": location,
    "score": score,
    "distance": distance,
    "locationISO": locationISO,
    "guessISO": guessISO
  }
  localStorage.setItem(`roundsResults`, JSON.stringify(resultsParsed));

  if (guessPosition) {
    let bounds = calculateLatLngBounds([location, guessPosition]);
    map.fitBounds(bounds);
  } else {
    if (location) {
      map.setCenter(location);
      map.setZoom(4);
    }
  }

  await showRoundResult(score, distance, locationISO, guessISO);
}

async function calculatePoints(area = 14916.862) {
  const markerPosition = markers[markers.length - 1].position;
  let lat = markerPosition?.lat;
  let lng = markerPosition?.lng;
  let distance = haversineDistance(location.lat(), location.lng(), lat, lng);
  let score;
  

  if(gamemode === "countrySelect"){
    let coords = turf.bbox(polygon.geometry)
    area = haversineDistance(coords[0],coords[1], coords[2], coords[3])
    score = 5000 * Math.E ** (-10 * distance / area);
    }else{
    score = 5000 * Math.E ** (-10 * distance / area);
  }

  
  return [score,distance];
}

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
};

function calculateLatLngBounds(coords) {
  // Create a LatLngBounds object
  const bounds = new google.maps.LatLngBounds();

  // Add each coordinate to the bounds
  coords.forEach(coord => {
      if (Array.isArray(coord)) {
          bounds.extend(new google.maps.LatLng(coord[0], coord[1]));
      } else {
          // bounds.extend() natively handles both LatLng objects and {lat, lng} literals
          bounds.extend(coord);
      }
  });

  return bounds;
}

function returnToStart() {
  let loc = new google.maps.LatLng(location)
  streetView.setPosition(loc)
  streetView.setPov({ heading: 0, pitch: 0 })
}

function closeScoresMenu(){
  scoresMenu.classList.remove("visible");
  scoresMenu.classList.add("hidden");
}

window.initialize = async () => {
  initialize();
};

