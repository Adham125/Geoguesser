let map: google.maps.Map;
let markers: google.maps.Marker[] = [];
let location: google.maps.LatLng | null | undefined

async function initialize(): Promise<void> {
  //const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
  let lat = Math.random() * (85 - -85) + -85;
  let lng = Math.random() * (170 - -170) + -170;
  
  location = new google.maps.LatLng(lat, lng)
  const fenway = { lat: 42.345573, lng: -71.098326 };
  map = new google.maps.Map(
    document.getElementById("map") as HTMLElement,
    {
      center: {lat: 0, lng: 0},
      zoom: 3,
      disableDefaultUI: true,
      mapId: "1b65baa89de7a1e3",
      }
  );
  map.setOptions({clickableIcons: false})
  map.addListener("click", (e) => {
    setMapOnAll(null);
    placeMarker(e.latLng);
  });


  document
    .getElementById("Confirm")!
    .addEventListener("click", confirmSelect);
  
  const streetViewService = new google.maps.StreetViewService();

  while(true){
    const request: google.maps.StreetViewLocationRequest = {
      location: new google.maps.LatLng(lat, lng),
      preference: google.maps.StreetViewPreference.NEAREST,
      radius: 1000000,
      sources: [google.maps.StreetViewSource.OUTDOOR, google.maps.StreetViewSource.GOOGLE]
    };
  
    const sv = await streetViewService.getPanorama(request, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location) {
        const streetView = new google.maps.StreetViewPanorama(document.getElementById("pano") as HTMLElement, {
          disableDefaultUI: true,
          showRoadLabels: false,
        });
        streetView.setPano(data.location.pano); // Set the pano ID from the StreetViewPanoramaData
        location = data.location.latLng
      }
    });
    if (sv != undefined){
      break
    }else{
      lat = Math.random() * (85 - -85) + -85;
      lng = Math.random() * (170 - -170) + -170;
    }
  }
}

class GameSessionStorage {
  // Save round results to session storage
  static saveRoundResults(roundId: number, results: [number, number, number]): void {
    sessionStorage.setItem(`round_${roundId}`, JSON.stringify(results));
  }

  // Retrieve round results from session storage
  static getRoundResults(roundId: number): [number, number, number] | null {
    const data = sessionStorage.getItem(`round_${roundId}`);
    return data ? JSON.parse(data) as [number, number, number] : null;
  }

  // Clear results for a specific round
  static clearRoundResults(roundId: number): void {
    sessionStorage.removeItem(`round_${roundId}`);
  }

  // Clear all round results
  static clearAllRounds(): void {
    sessionStorage.clear();
  }
}

function placeMarker(latLng: google.maps.LatLng) {
  const markerNew = new google.maps.Marker({
    position: latLng,
    map,
    clickable: false,
  });

  markers.push(markerNew);
}

function setMapOnAll(map: google.maps.Map | null) {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function confirmSelect() {
  if (markers.length > 0 ){
    const points = Math.floor(calculatePoints())
    alert(`You scored ${points}`)

    initialize()
  }else{
    alert("You need to select a location first!");
  }
}

function calculatePoints(){
  const markerPosition = markers[markers.length-1].getPosition();
  let lat = markerPosition?.lat()
  let lng = markerPosition?.lng()
  let distance = haversineDistance(location, lat, lng)

  const score = 5000 * Math.E ** (-10 * distance / 14916.862)
  return score
}

const haversineDistance = (latlng, lat2, lon2): number => {
  const R = 6371; // Earth's radius in kilometers
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

  //console.log(latlng.lat(), latlng.lng(), lat2, lon2)
  const φ1 = toRadians(latlng.lat());
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - latlng.lat());
  const Δλ = toRadians(lon2 - latlng.lng());
  //console.log(φ1, φ2, Δφ, Δλ)
  
  // Haversine formula
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distance in kilometers
  const distance = R * c;
  return distance;
};

const styles: Record<string, google.maps.MapTypeStyle[]> = {
  default: [],
  hide: [
    {
      featureType: "labels.icons",
      stylers: [{ visibility: "off",}],
    },
    {
      featureType: "transit",
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
  ],
};

declare global {
  interface Window {
    initialize: () => void;
  }
}

window.initialize = async () => { initialize(); };
export {};
