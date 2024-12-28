let map: google.maps.Map;
let markers: google.maps.Marker[] = [];
let location: {lat: number, lng: number}

async function initialize(lat: number, lng: number): Promise<void> {
  //const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
  location = { lat: lat, lng: lng };
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
      }
    });
    console.log(sv)
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

}

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
let lat = Math.random() * (85 - -85) + -85;
let lng = Math.random() * (170 - -170) + -170;
window.initialize = async () => { initialize(lat, lng); };
export {};
