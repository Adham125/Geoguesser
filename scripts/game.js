let map;
const mapcss = document.getElementById("map");
const panocss = document.getElementById("pano");
let streetView;
let markers = [];
let gamemode;
let polyLine;
let location = null;
const confirmButton = document.getElementById("Confirm");
const nextButton = document.getElementById("Next");

const tooltip = document.getElementById("slider-tooltip");
const slider = document.getElementById("myRange")
updateTooltip();
slider.addEventListener("input", updateTooltip);

const rounds = JSON.parse(localStorage.getItem("rounds"));

async function initialize() {
  let lat = Math.random() * (85 - -85) + -85;
  let lng = Math.random() * (170 - -170) + -170;

  location = new google.maps.LatLng(lat, lng);
  //const fenway = { lat: 42.345573, lng: -71.098326 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    disableDefaultUI: true,
    mapId: "1b65baa89de7a1e3",
  });
  map.setOptions({ clickableIcons: false });
  map.addListener("click", (e) => {
    setMapOnAll(null);
    placeMarker(e.latLng, "FF6347");
  });

  confirmButton.addEventListener("click", confirmSelect);
  nextButton.addEventListener("click", nextRound);
  nextButton.disabled = true;

  const streetViewService = new google.maps.StreetViewService();

  gamemode = JSON.parse(localStorage.getItem("gameMode"));
  var source;
  if(gamemode == "easy"){
      source = [google.maps.StreetViewSource.GOOGLE];
  }else if(gamemode == "medium"){
      source = [google.maps.StreetViewSource.GOOGLE, google.maps.StreetViewSource.OUTDOOR];
  }else if(gamemode == "hard"){
      source = [google.maps.StreetViewSource.DEFAULT];
  }

  var options = JSON.parse(localStorage.getItem("gameOptions"));

  while (true) {
    const request = {
      location: new google.maps.LatLng(lat, lng),
      preference: google.maps.StreetViewPreference.NEAREST,
      radius: Number(document.getElementById("myRange").value),
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
      break;
    } else {
      document.getElementById('loading-spinner').style.display = 'block';  // Show spinner
      lat = Math.random() * (85 - -85) + -85;
      lng = Math.random() * (170 - -170) + -170;
    }
  }

  document.getElementById('loading-spinner').style.display = 'none';
  streetView.addListener("pov_changed", () => {
    const heading = streetView.getPov().heading; // Get the current heading in degrees
    const compassImage = document.getElementById("compass-image");
    // Rotate the compass based on heading
    compassImage.style.transform = `rotate(${heading}deg)`;
});
}

class GameSessionStorage {
  static saveRoundResults(roundId, results) {
    sessionStorage.setItem(`round_${roundId}`, JSON.stringify(results));
  }

  static getRoundResults(roundId) {
    const data = sessionStorage.getItem(`round_${roundId}`);
    return data ? JSON.parse(data) : null;
  }

  static clearRoundResults(roundId) {
    sessionStorage.removeItem(`round_${roundId}`);
  }

  static clearAllRounds() {
    sessionStorage.clear();
  }
}

function placeMarker(latLng, colour) {
  let markerNew;
  if (colour == "00FF00"){
    const img = document.createElement("img");
    img.src = "../imgs/red-flag.png";
    img.style.width = "60px"; // Adjust the size as needed
    img.style.height = "40px"; // Adjust the size as needed
    img.style.pointerEvents = "none"; // Ensures the image doesn't interfere with user interactions

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

function nextRound() {
  confirmButton.disabled = false;
  mapcss.classList.toggle("swapped");
  panocss.classList.toggle("swapped");
  markers = []
  initialize();
}

function confirmSelect() {
  if (markers.length > 0) {
    const pointsReturn = calculatePoints()
    const points = Math.floor(pointsReturn[0]);
    const distance = Math.floor(pointsReturn[1]);

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

    alert(`You scored ${points}\nDistance to location was ${distance}Km`);
    let bounds = new google.maps.LatLngBounds(markers[markers.length - 1].position, markers[markers.length - 2].position);
    
    map.fitBounds(bounds);
    //console.log(Math.ceil(distance/1000))
    map.setZoom(3);
  } else {
    alert("You need to select a location first!");
  }
}

function calculatePoints() {
  const markerPosition = markers[markers.length - 1].position;
  let lat = markerPosition?.lat;
  let lng = markerPosition?.lng;
  let distance = haversineDistance(location, lat, lng);

  const score = 5000 * Math.E ** (-10 * distance / 14916.862);
  return [score,distance];
}

const haversineDistance = (latlng, lat2, lon2) => {
  const R = 6371;
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const φ1 = toRadians(latlng.lat());
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - latlng.lat());
  const Δλ = toRadians(lon2 - latlng.lng());

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
};

function updateTooltip() {
  const sliderValue = slider.value;

  // Update the tooltip text
  tooltip.textContent = sliderValue;

  // Calculate the position of the tooltip below the slider thumb
  const sliderRect = slider.getBoundingClientRect();
  const thumbOffset = ((sliderValue - slider.min) / (slider.max - slider.min)) * (sliderRect.width)  + 100;

  // Update tooltip position
  tooltip.style.left = `${thumbOffset}px`;
}

window.initialize = async () => {
  initialize();
};
