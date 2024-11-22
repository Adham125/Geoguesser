let map: google.maps.Map;
let markers: google.maps.Marker[] = [];

async function initialize() {
  //const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
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

  const panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano") as HTMLElement,
    {
      position: fenway,
      pov: {
        heading: 34,
        pitch: 10,
        },
      disableDefaultUI: true,
      showRoadLabels: false,    
    }
  );

  map.setStreetView(panorama);
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
window.initialize = initialize;

export {};
