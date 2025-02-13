import { pickRandomPoint } from './geojson.js';

const geojsonFilePath = '../geojson/world.geojson';
var map;
var clickListener;
const mapcss = document.getElementById("map");
const panocss = document.getElementById("pano");
var streetView;
var streetViewId;
var markers = [];
var polyLine;
var location = null;

const confirmButton = document.getElementById("Confirm");
const nextButton = document.getElementById("Next");
const closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click", closeScoresMenu);
const startPosButton = document.getElementById("Start_Location");
  startPosButton.addEventListener("click", returnToStart)
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
var ongoingScoreElement = document.getElementById('player-scores');

const socket = io('http://16.171.186.49:3000');
//const socket = io('http://localhost:3000');

var roomName = JSON.parse(localStorage.getItem("roomCode"))
var hosting = JSON.parse(localStorage.getItem("roomHost"))
var playerName = localStorage.getItem("playerName");
var playerColour = localStorage.getItem("playerColour");
var playerScoreMap = {}

if (options.timer) {
  resetTimer()
}else{
  timer.style.display = "none"
}

socket.emit("joinedGame", [roomName, playerName, playerColour])

socket.on("playerJoined", players => { // vars = players {name, colour}

  ongoingScoreElement.innerHTML = ''; // Clear existing scores
  for (const player in players) {
    const scoreDiv = document.createElement('div');

    const playerNameSpan = document.createElement('span');
    playerNameSpan.classList.add('player-name');
    playerNameSpan.style.color = players[player].colour; // Color for the name
    playerNameSpan.textContent = `${players[player].name}: `

    const scoreSpan = document.createElement('span'); // Span for the score
    scoreSpan.classList.add('score');
    //scoreSpan.style.color = players[player].colour; 
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

socket.on("roomStartLocation", vars => {   // vars = [location, polygon, streetViewId]
  if (!hosting){
    let temp = new google.maps.LatLng({lat: vars[0].lat, lng: vars[0].lng});
    location = temp

    polygon = vars[1]
    streetViewId = vars[2]
    
    initialize(streetViewId);
  }
})

socket.on("initNextRound", function() { 

  for (const player in playerScoreMap){   // Remove all check marks
    playerScoreMap[player][2].style.display = 'none'
  }
  
  if (hosting){
    initialize()
  }else{
    currentRound++;
    confirmButton.disabled = false;
    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");
  }
})

socket.on("playerGuessed", player => {
  //TODO: player guess notification ("guess" next to current score)
  playerScoreMap[player][2].style.display = 'block'
});

socket.on("drawGuess", vars => { // vars = resultsParsed[`round${round}`]
  let results = vars

  for (const player in results) {
    if (player == socket.id){
      
    }else{
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
    mapId: "1b65baa89de7a1e3",
  });
  map.setOptions({ clickableIcons: false });
  if (roomName == "Singleplayer"){
    if(ongoingScoreElement.children.length == 0){
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
    

    clickListener = map.addListener("click", (e) => {
      setMapOnAll(null);
      placeMarker(e.latLng);
    });
  }else{
    clickListener = map.addListener("click", (e) => {
      setMapOnAll(null);
      placeMarker(e.latLng, playerColour);
    });
  }
  

  nextButton.disabled = true;

  if (roomName == "Singleplayer"){         // <----------------- Singleplayer
    await getStreetView ()
  }else{                  // <------------------- Multiplayer
    if (hosting){     // Host actions
      await getStreetView()
      socket.emit("initialize", [roomName, location, polygon, streetViewId])
    }
  }

  if(id != null){      // Other players actions
    await getStreetView(id)
  }
}

function placeMarker(latLng, colour = "#FF6347") {
  let markerNew;
  if (colour == "flag"){
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
  }else if(colour == "#FF6347") {   // Default
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
    //confirmSelect(true)
    return;
  }

  totalSeconds--; // Decrease the timer by 1 second

  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  // Format the time as MM:SS
  let formattedTime = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  timer.textContent = formattedTime;
}

function resetTimer () {
  totalSeconds = JSON.parse(localStorage.getItem("timer"))
  timerInterval = setInterval(updateTimer, 1000);
  timer.style.display = 'block';
}

async function getStreetView (id = null) {             //<------------------ Main
  var source;
  var pref;
  var countryISO = null;
  if(gamemode == "classic"){
      source = [google.maps.StreetViewSource.GOOGLE];
      pref = google.maps.StreetViewPreference.BEST;
  }else if (gamemode == "countrySelect"){
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
  }
  document.getElementById('loading-spinner').style.display = 'none';
  streetView.addListener("pov_changed", () => {
    const heading = streetView.getPov().heading; // Get the current heading in degrees
    const compassImage = document.getElementById("compass-image");
    compassImage.style.transform = `rotate(${heading}deg)`;  // Rotate the compass based on heading
  });
}

function populateMultiplayerScores(scores = null) {      // Server score: [`round${round}`][socket.id] { "guess": guess, "location": location, "score": score, "distance": distance}                                                         
  google.maps.event.removeListener(clickListener);
  panocss.classList.toggle("hidden")
  markers = []
  nextButton.disabled = true
  var allCoords = []
  var dataAll
  var totalScores = {}
  var maxScore = roundsMax * 5000
  if( scores == null){
    dataAll = JSON.parse(localStorage.getItem("roundsResults"))
  }else{
    dataAll = JSON.parse(scores)
  }
  
  scoresList.innerHTML = ""; // Clear existing scores

  if(roomName != "Singleplayer"){
    // Create the table
    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.margin = "20px 0";
    table.style.textAlign = "left";

    // Add a header row
    const headerRow = `
      <tr>
        <th style="border: 1px solid black; padding: 8px;">Player</th>
        <th style="border: 1px solid black; padding: 8px;">Round</th>
        <th style="border: 1px solid black; padding: 8px;">Score</th>
      </tr>
    `;
    table.innerHTML += headerRow;

    const playerTotals = {}; // To track total scores and distances for each player

    // Loop through rounds and players
    for (let i = 1; i <= roundsMax; i++) {
      const data = dataAll[`round${i}`];

      for (const player in data) {
        const playerResults = data[player];

        // Initialize totals if not already set
        if (!playerTotals[player]) {
          playerTotals[player] = { totalPoints: 0, totalDistance: 0 };
        }

        // Add to player's totals
        playerTotals[player].totalPoints += playerResults.score;
        playerTotals[player].totalDistance += playerResults.distance;

        // Add a row for the current round
        const row = `
          <tr>
            <td style="border: 1px solid black; padding: 8px;">${player === socket.id ? "<strong>You</strong>" : player}</td>
            <td style="border: 1px solid black; padding: 8px;">Round ${i}</td>
            <td style="border: 1px solid black; padding: 8px;">${playerResults.score}</td>
          </tr>
        `;
        //table.innerHTML += row;

        if (player == socket.id){
          polyLine = new google.maps.Polyline({
            path: [playerResults.guess, playerResults.location],
            geodesic: true,
            strokeColor: playerColour,
            strokeOpacity: 1.0, 
            strokeWeight: 2,
            map: map
          });
          
          placeMarker(playerResults.location, "flag");
          placeMarker(playerResults.guess, playerColour);
      
          allCoords.push(playerResults.location, playerResults.guess)
        
        }else{
          polyLine = new google.maps.Polyline({
            path: [playerResults.guess, playerResults.location],
            geodesic: true,
            strokeColor: playerResults.colour,
            strokeOpacity: 1.0, 
            strokeWeight: 2,
            map: map
          });
  
          
          placeMarker(playerResults.guess, playerResults.colour);
      
          allCoords.push(playerResults.location, playerResults.guess)
        }
      }
    }

    // Convert playerTotals object into an array of [player, data] pairs
    const playerTotalsArray = Object.entries(playerTotals);

    // Sort the array by total points in descending order
    playerTotalsArray.sort((a, b) => b[1].totalPoints - a[1].totalPoints);

    // Add a row for totals for each player
    playerTotalsArray.forEach(([player, data]) => {
      const totalRow = `
        <tr style="background-color: #f0f0f0;">
          <td style="border: 1px solid black; padding: 8px;">${player === socket.id ? "<strong>You</strong>" : player}</td>
          <td style="border: 1px solid black; padding: 8px;">Total</td>
          <td style="border: 1px solid black; padding: 8px;">${data.totalPoints}</td>
        </tr>
      `;
      table.innerHTML += totalRow;
    });

    // Append the table to the scores menu
    scoresList.appendChild(table);
  }else{                                 // If singleplayer
    for (let i=1; i <= roundsMax; i++){      
    
      let data = dataAll[`round${i}`]
      const li = document.createElement("li");
      li.textContent = `Round ${i}: ${data.score} points  |  ${data.distance} km`;
      scoresList.appendChild(li);
  
      placeMarker(data.location, "flag");
      placeMarker(data.guess);
  
      allCoords.push(data.location, data.guess)
  
      polyLine = new google.maps.Polyline({
        path: [data.guess, data.location],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0, 
        strokeWeight: 2 
      });
      polyLine.setMap(map);
    }
  }

  

  let bounds = calculateLatLngBounds(allCoords)
  map.fitBounds(bounds)

  // Show the menu
  scoresMenu.classList.remove("hidden");
  scoresMenu.classList.add("visible");
}

function nextRound() {
  currentRound++;
  if (currentRound > roundsMax){         // End of Game Logic
    if(roomName == "Singleplayer"){
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

    if(roomName == "Singleplayer"){
      initialize();
    }else{
      socket.emit("startNextRound", roomName)
    }
  }
}

async function confirmSelect(timedOut) {
  if (markers.length > 0) {
    clearInterval(timerInterval)
    timer.style.display = 'none';

    const pointsReturn = await calculatePoints()
    let score;
    
    if (!timedOut){
      score = Math.floor(pointsReturn[0]);
    } else{
      score = 0
    }
    
    distance = Math.floor(pointsReturn[1]);

    placeMarker(location, "flag"); 

    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");

    confirmButton.disabled = true;

    if (roomName == "Singleplayer"){
      ongoingScoreElement.innerHTML = ''; // Clear existing scores
      ongoingScore = ongoingScore + score

      const scoreDiv = document.createElement('div');
      scoreDiv.textContent = `Score: ${ongoingScore}`; // Display score directly
      ongoingScoreElement.appendChild(scoreDiv);

      nextButton.disabled = false;
      polyLine = new google.maps.Polyline({
        path: [markers[markers.length-1].position, markers[markers.length-2].position],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0, 
        strokeWeight: 2 
      });
      polyLine.setMap(map);
    }else{
      polyLine = new google.maps.Polyline({
        path: [markers[markers.length-1].position, markers[markers.length-2].position],
        geodesic: true,
        strokeColor: playerColour,
        strokeOpacity: 1.0, 
        strokeWeight: 2 
      });
      polyLine.setMap(map);

      socket.emit("guessed", [roomName, markers[markers.length-2].position, currentRound, location, score, distance, playerColour])
    }

    google.maps.event.removeListener(clickListener);

    let results = localStorage.getItem("roundsResults")
    let resultsParsed = {};
    if (results){
      resultsParsed = JSON.parse(results)
    }

    resultsParsed[`round${currentRound}`] = {
      "guess": markers[markers.length-2].position, 
      "location": location,
      "score": score,
      "distance": distance
    }
    localStorage.setItem(`roundsResults`, JSON.stringify(resultsParsed));
    //{lat: -85, lng: -170}
    let bounds = calculateLatLngBounds([markers[markers.length - 1].position, markers[markers.length - 2].position]);

    map.fitBounds(bounds);
    
    alert(`You scored ${score}\nDistance to location was ${distance}Km`);
    
  } else {
    alert("You need to select a location first!");
  }
}

async function calculatePoints(area = 14916.862) {
  const markerPosition = markers[markers.length - 1].position;
  let lat = markerPosition?.lat;
  let lng = markerPosition?.lng;
  let distance = haversineDistance(location.lat(), location.lng(), lat, lng);
  let score;
  

  if(gamemode == "countrySelect"){
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
      // Support both [lat, lng] and { lat, lng } formats
      if (Array.isArray(coord)) {
          bounds.extend(new google.maps.LatLng(coord[0], coord[1]));
      } else if (typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
          bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      } else {
          throw new Error("Invalid coordinate format");
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

