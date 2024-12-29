let map;
let streetView;
let markers = [];
let location = null;
const confirmButton = document.getElementById("Confirm");
const nextButton = document.getElementById("Next");

async function initialize() {
  let lat = Math.random() * (85 - -85) + -85;
  let lng = Math.random() * (170 - -170) + -170;

  location = new google.maps.LatLng(lat, lng);
  //const fenway = { lat: 42.345573, lng: -71.098326 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 3,
    disableDefaultUI: true,
    mapId: "1b65baa89de7a1e3",
  });
  map.setOptions({ clickableIcons: false });
  map.addListener("click", (e) => {
    setMapOnAll(null);
    placeMarker(e.latLng);
  });

  confirmButton.addEventListener("click", confirmSelect);
  nextButton.addEventListener("click", nextRound);
  nextButton.disabled = true;

  const streetViewService = new google.maps.StreetViewService();

  while (true) {
    const request = {
      location: new google.maps.LatLng(lat, lng),
      preference: google.maps.StreetViewPreference.NEAREST,
      radius: Number(document.getElementById("myRange").value),
      sources: [google.maps.StreetViewSource.GOOGLE],
    };
    console.log(document.getElementById("myRange").value)

    const sv = await streetViewService.getPanorama(request, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location) {
          streetView = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
          disableDefaultUI: true,
          showRoadLabels: false,
        });
        streetView.setPano(data.location.pano);
        location = data.location.latLng;
      }
    });
    if (sv !== undefined) {
      break;
    } else {
      lat = Math.random() * (85 - -85) + -85;
      lng = Math.random() * (170 - -170) + -170;
    }
  }

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

function placeMarker(latLng) {
  const markerNew = new google.maps.Marker({
    position: latLng,
    map,
    clickable: false,
  });

  markers.push(markerNew);
}

function setMapOnAll(map) {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function nextRound() {
  confirmButton.disabled = false;
  initialize();
}

function confirmSelect() {
  if (markers.length > 0) {
    const pointsReturn = calculatePoints()
    const points = Math.floor(pointsReturn[0]);
    const distance = Math.floor(pointsReturn[1]);
    placeMarker(location);
    confirmButton.disabled = true;
    nextButton.disabled = false;
    alert(`You scored ${points}\nDistance to location was ${distance}Km`);
    let bounds = new google.maps.LatLngBounds(location, markers[markers.length - 2].getPosition());
    map.fitBounds(bounds);
  } else {
    alert("You need to select a location first!");
  }
}

function calculatePoints() {
  const markerPosition = markers[markers.length - 1].getPosition();
  let lat = markerPosition?.lat();
  let lng = markerPosition?.lng();
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

const styles = {
  default: [],
  hide: [
    {
      featureType: "labels.icons",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
  ],
};

window.initialize = async () => {
  initialize();
};