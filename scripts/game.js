import { pickRandomPoint, loadGeoJSON } from './geojson.js';

const geojsonFilePath = '../geojson/world.geojson';
var map;
var clickListener;
const mapcss = document.getElementById("map");
const panocss = document.getElementById("pano");
let streetView;
let markers = [];
let polyLine;
let location = null;

const confirmButton = document.getElementById("Confirm");
const nextButton = document.getElementById("Next");
const closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click", closeScoresMenu);
const startPosButton = document.getElementById("Start_Location");
  startPosButton.addEventListener("click", returnToStart)
const timer = document.getElementById("timer");


var roundsMax = JSON.parse(localStorage.getItem("rounds"));
var currentRound = 1;
var scoresMenu = document.getElementById("scoresMenu");
var scoresList = document.getElementById("scoresList");

var score;
var distance;

var gamemode = JSON.parse(localStorage.getItem("gameMode"));
var polygon;

var options = JSON.parse(localStorage.getItem("gameOptions"));
var totalSeconds = JSON.parse(localStorage.getItem("timer"))
var timerInterval;

if (options.timer) {
  resetTimer()
}else{
  timer.style.display = "none"
}

async function initialize(loc = null) {
  //const fenway = { lat: 42.345573, lng: -71.098326 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    disableDefaultUI: true,
    mapId: "1b65baa89de7a1e3",
  });
  map.setOptions({ clickableIcons: false });
  clickListener = map.addListener("click", (e) => {
    setMapOnAll(null);
    placeMarker(e.latLng);
  });

  confirmButton.addEventListener("click", async function(event) {
    event.preventDefault(); 
    await confirmSelect(false);
  });
  nextButton.addEventListener("click", nextRound);
  nextButton.disabled = true;

  const streetViewService = new google.maps.StreetViewService();

  
  var source;
  var pref;
  var countryISO = null;
  if(gamemode == "classic"){
      source = [google.maps.StreetViewSource.GOOGLE];
      pref = google.maps.StreetViewPreference.BEST;
  }else if(gamemode == "medium"){
      source = [google.maps.StreetViewSource.GOOGLE, google.maps.StreetViewSource.OUTDOOR];
      pref = google.maps.StreetViewPreference.NEAREST;
  }else if(gamemode == "hard"){
      source = [google.maps.StreetViewSource.DEFAULT];
      pref = google.maps.StreetViewPreference.NEAREST;
  }else if (gamemode == "countrySelect"){
    source = [google.maps.StreetViewSource.GOOGLE];
    pref = google.maps.StreetViewPreference.BEST;
    countryISO = JSON.parse(localStorage.getItem("selectedCountry"))
  }
  
  while (true) {
    try {
      var randomPoint
      if (loc == null){
        let temp = await pickRandomPoint(countryISO); // Get a random point
        polygon = temp[2]
        temp = temp[0]
        randomPoint = new google.maps.LatLng({lat: temp.geometry.coordinates[1], lng: temp.geometry.coordinates[0]});
      }else {
        randomPoint = loc
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  
    location = randomPoint

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
        streetView.setPano(data.location.pano);
        location = data.location.latLng;
      }
    });
    if (sv !== undefined) {
      //console.log(location.lat(), location.lng())
      break;
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

function placeMarker(latLng, colour = "FF6347") {
  let markerNew;
  if (colour == "00FF00"){
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
  }else{
    markerNew = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map: map, 
      content: new google.maps.marker.PinElement({background: `#${colour}`,}).element,
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

function nextRound() {
  currentRound++;
  if (currentRound > roundsMax){             // End of Game Logic
    panocss.classList.toggle("hidden")
    markers = []
    nextButton.disabled = true
    var allCoords = []
    var dataAll = JSON.parse(localStorage.getItem("roundsResults"))
    scoresList.innerHTML = ""; // Clear existing scores
    for (let i=1; i <= roundsMax; i++){                                 
      
      let data = dataAll[`round${i}`]
      const li = document.createElement("li");
      li.textContent = `Round ${i}: ${data.score} points  |  ${data.distance} km`;
      scoresList.appendChild(li);

      placeMarker(data.location, "00FF00");
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
    let bounds = calculateLatLngBounds(allCoords)
    map.fitBounds(bounds)

    // Show the menu
    scoresMenu.classList.remove("hidden");
    scoresMenu.classList.add("visible");

  }else{                              // Next Round Logic
    confirmButton.disabled = false;
    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");
    markers = []
    if (!options.timer) {
      resetTimer()
    }
    initialize();
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

    placeMarker(location, "00FF00");

    polyLine = new google.maps.Polyline({
      path: [markers[markers.length-1].position, markers[markers.length-2].position],
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 1.0, 
      strokeWeight: 2 
    });
    polyLine.setMap(map); 

    mapcss.classList.toggle("swapped");
    panocss.classList.toggle("swapped");

    confirmButton.disabled = true;
    nextButton.disabled = false;

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
  let coords = turf.bbox(polygon.geometry)

  if(gamemode == "countrySelect"){
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