export async function pickRandomPoint(geojson) {
  const features = geojson.features;

  const areas = features.map(feature => {
    const geometry = feature.geometry;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return turf.area(feature); // Use named import
    }
    return 0; // Ignore non-polygon geometries
  });

  const totalArea = areas.reduce((sum, area) => sum + area, 0);
  const weights = areas.map(area => area / totalArea);

  const randomValue = Math.random();
  let cumulativeWeight = 0;
  let selectedFeatureIndex = -1;

  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (randomValue < cumulativeWeight) {
      selectedFeatureIndex = i;
      break;
    }
  }

  const selectedFeature = features[selectedFeatureIndex];
  const geometry = selectedFeature.geometry;

  let randomPointResult = null;

  if (geometry.type === "Polygon") {
    randomPointResult = getRandomPointInPolygon(geometry);
  } else if (geometry.type === "MultiPolygon") {
    const subPolygonAreas = geometry.coordinates.map(polygonCoords => {
      const polygon = {
        type: "Polygon",
        coordinates: polygonCoords
      };
      return turf.area(polygon); // Use named import
    });

    const totalSubArea = subPolygonAreas.reduce((sum, area) => sum + area, 0);
    const subWeights = subPolygonAreas.map(area => area / totalSubArea);

    let subRandomValue = Math.random();
    let subCumulativeWeight = 0;
    let selectedSubPolygonIndex = -1;

    for (let i = 0; i < subWeights.length; i++) {
      subCumulativeWeight += subWeights[i];
      if (subRandomValue < subCumulativeWeight) {
        selectedSubPolygonIndex = i;
        break;
      }
    }

    const selectedSubPolygonCoords = geometry.coordinates[selectedSubPolygonIndex];
    const selectedSubPolygon = {
      type: "Polygon",
      coordinates: selectedSubPolygonCoords
    };

    randomPointResult = getRandomPointInPolygon(selectedSubPolygon);
  }

  return randomPointResult;
}

function getRandomPointInPolygon(polygon) {
  while (true) {
    const bboxCoords = turf.bbox(polygon); // Use named import
    const randomPointResult = turf.randomPoint(1, { bbox: bboxCoords }).features[0]; // Use named import
    if (turf.booleanPointInPolygon(randomPointResult, polygon)) { // Use named import
      return randomPointResult;
    }
  }
}

export async function loadGeoJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
      throw error;
    }
  }
