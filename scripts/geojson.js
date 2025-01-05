export async function pickRandomPoint(countryISOName) {

  const iso_codes = [
    'ABW',
    'AFG',
    'AGO',
    'AIA',
    'ALB',
    'ALD',
    'AND',
    'ARE',
    'ARG',
    'ARM',
    'ASM',
    'ATA',
    'ATC',
    'ATF',
    'ATG',
    'AUS',
    'AUT',
    'AZE',
    'BDI',
    'BEL',
    'BEN',
    'BFA',
    'BGD',
    'BGR',
    'BHR',
    'BHS',
    'BIH',
    'BJN',
    'BLM',
    'BLR',
    'BLZ',
    'BMU',
    'BOL',
    'BRA',
    'BRB',
    'BRN',
    'BTN',
    'BWA',
    'CAF',
    'CAN',
    'CHE',
    'CHL',
    'CHN',
    'CIV',
    'CLP',
    'CMR',
    'CNM',
    'COD',
    'COG',
    'COK',
    'COL',
    'COM',
    'CPV',
    'CRI',
    'CSI',
    'CUB',
    'CUW',
    'CYM',
    'CYN',
    'CYP',
    'CZE',
    'DEU',
    'DJI',
    'DMA',
    'DNK',
    'DOM',
    'DZA',
    'ECU',
    'EGY',
    'ERI',
    'ESB',
    'ESP',
    'EST',
    'ETH',
    'FIN',
    'FJI',
    'FLK',
    'FRA',
    'FRO',
    'FSM',
    'GAB',
    'GBR',
    'GEO',
    'GGY',
    'GHA',
    'GIB',
    'GIN',
    'GMB',
    'GNB',
    'GNQ',
    'GRC',
    'GRD',
    'GRL',
    'GTM',
    'GUM',
    'GUY',
    'HKG',
    'HMD',
    'HND',
    'HRV',
    'HTI',
    'HUN',
    'IDN',
    'IMN',
    'IND',
    'IOA',
    'IOT',
    'IRL',
    'IRN',
    'IRQ',
    'ISL',
    'ISR',
    'ITA',
    'JAM',
    'JEY',
    'JOR',
    'JPN',
    'KAB',
    'KAS',
    'KAZ',
    'KEN',
    'KGZ',
    'KHM',
    'KIR',
    'KNA',
    'KOR',
    'KOS',
    'KWT',
    'LAO',
    'LBN',
    'LBR',
    'LBY',
    'LCA',
    'LIE',
    'LKA',
    'LSO',
    'LTU',
    'LUX',
    'LVA',
    'MAC',
    'MAF',
    'MAR',
    'MCO',
    'MDA',
    'MDG',
    'MDV',
    'MEX',
    'MHL',
    'MKD',
    'MLI',
    'MLT',
    'MMR',
    'MNE',
    'MNG',
    'MNP',
    'MOZ',
    'MRT',
    'MSR',
    'MUS',
    'MWI',
    'MYS',
    'NAM',
    'NCL',
    'NER',
    'NFK',
    'NGA',
    'NIC',
    'NIU',
    'NLD',
    'NOR',
    'NPL',
    'NRU',
    'NZL',
    'OMN',
    'PAK',
    'PAN',
    'PCN',
    'PER',
    'PGA',
    'PHL',
    'PLW',
    'PNG',
    'POL',
    'PRI',
    'PRK',
    'PRT',
    'PRY',
    'PSX',
    'PYF',
    'QAT',
    'ROU',
    'RUS',
    'RWA',
    'SAH',
    'SAU',
    'SCR',
    'SDN',
    'SDS',
    'SEN',
    'SER',
    'SGP',
    'SGS',
    'SHN',
    'SLB',
    'SLE',
    'SLV',
    'SMR',
    'SOL',
    'SOM',
    'SPM',
    'SRB',
    'STP',
    'SUR',
    'SVK',
    'SVN',
    'SWE',
    'SWZ',
    'SXM',
    'SYC',
    'SYR',
    'TCA',
    'TCD',
    'TGO',
    'THA',
    'TJK',
    'TKM',
    'TLS',
    'TON',
    'TTO',
    'TUN',
    'TUR',
    'TUV',
    'TWN',
    'TZA',
    'UGA',
    'UKR',
    'UMI',
    'URY',
    'USA',
    'USG',
    'UZB',
    'VAT',
    'VCT',
    'VEN',
    'VGB',
    'VIR',
    'VNM',
    'VUT',
    'WLF',
    'WSB',
    'WSM',
    'YEM',
    'ZAF',
    'ZMB',
    'ZWE'
  ]

  const all_countries_with_street_view = [
    "AFG", "AGO", "ALB", "AND", "ARE", "ARG", "ARM", "AUS", "AUT", "AZE",
    "BDI", "BEL", "BEN", "BFA", "BGD", "BGR", "BHR", "BHS", "BIH", "BLR",
    "BLZ", "BOL", "BRA", "BRB", "BRN", "BTN", "BWA", "CAF", "CAN", "CHE",
    "CHL", "CHN", "CIV", "CMR", "COD", "COG", "COL", "COM", "CPV", "CRI",
    "CUB", "CYP", "CZE", "DEU", "DJI", "DMA", "DNK", "DOM", "DZA", "ECU",
    "EGY", "ERI", "ESP", "EST", "ETH", "FIN", "FJI", "FRA", "GAB", "GBR",
    "GEO", "GHA", "GIN", "GMB", "GNB", "GNQ", "GRC", "GRD", "GTM", "GUY",
    "HKG", "HND", "HRV", "HTI", "HUN", "IDN", "IND", "IRL", "IRN", "IRQ",
    "ISL", "ISR", "ITA", "JAM", "JOR", "JPN", "KAZ", "KEN", "KGZ", "KHM",
    "KIR", "KNA", "KOR", "KWT", "LAO", "LBN", "LBR", "LBY", "LCA", "LIE",
    "LKA", "LSO", "LTU", "LUX", "LVA", "MAR", "MCO", "MDA", "MDG", "MDV",
    "MEX", "MHL", "MKD", "MLI", "MLT", "MMR", "MNE", "MNG", "MOZ", "MRT",
    "MUS", "MWI", "MYS", "NAM", "NER", "NGA", "NIC", "NLD", "NOR", "NPL",
    "NRU", "NZL", "OMN", "PAK", "PAN", "PER", "PHL", "PLW", "PNG", "POL",
    "PRT", "PRY", "QAT", "ROU", "RUS", "RWA", "SAU", "SDN", "SEN", "SGP",
    "SLB", "SLE", "SLV", "SMR", "SOM", "SRB", "SSD", "STP", "SUR", "SVK",
    "SVN", "SWE", "SWZ", "SYC", "SYR", "TCD", "TGO", "THA", "TJK", "TKM",
    "TLS", "TON", "TTO", "TUN", "TUR", "TUV", "TZA", "UGA", "UKR", "URY",
    "USA", "UZB", "VCT", "VEN", "VNM", "VUT", "WSM", "YEM", "ZAF", "ZMB", "ZWE"
  ]

  const countries_with_official_street_view = [
    "AFG", "ALB", "AND", "ARG", "AUS", "AUT", "BEL", "BGR", "BHR", "BIH",
    "BLR", "BRA", "CAN", "CHE", "CHL", "CHN", "COL", "CRI", "CZE", "DEU",
    "DNK", "DOM", "ECU", "EGY", "ESP", "EST", "FIN", "FRA", "GBR", "GRC",
    "GRL", "GTM", "HKG", "HRV", "HUN", "IDN", "IND", "IRL", "ISL", "ISR",
    "ITA", "JPN", "JOR", "KAZ", "KEN", "KGZ", "KHM", "KOR", "LAO", "LBN",
    "LTU", "LUX", "LVA", "MAC", "MEX", "MKD", "MLT", "MNE", "MNG", "NLD",
    "NOR", "NZL", "OMN", "PAK", "PAN", "PER", "PHL", "POL", "PRT", "QAT",
    "ROU", "RUS", "RWA", "SAU", "SEN", "SGP", "SVK", "SVN", "SWE", "THA",
    "TUN", "TUR", "UGA", "UKR", "URY", "USA", "VNM", "ZAF"
  ]
  let randomIndex = Math.floor(Math.random() * countries_with_official_street_view.length);
  var countryISO = null;

  if (countryISOName != null){
    countryISO = countryISOName
  }else{
    countryISO = countries_with_official_street_view[randomIndex]
  }

  const country = await loadGeoJSON(`../geojson/${countryISO}.geojson`);
  console.log(country)
  
  var selectedPolygon;
  const geometry = country.geometry;

  // Check if it's a single polygon or multi-polygon
  if (geometry.type === 'Polygon') {
    const polygon = turf.polygon(geometry.coordinates);
    selectedPolygon = polygon;
  } else if (geometry.type === 'MultiPolygon') {
    // Calculate the area of each sub-polygon
    const polygons = geometry.coordinates.map(coords => turf.polygon(coords));
    
    // Calculate the area for each polygon
    const areas = polygons.map(polygon => turf.area(polygon));

    // Calculate total area
    const totalArea = areas.reduce((sum, area) => sum + area, 0);

    // Calculate the probability for each polygon based on area
    const probabilities = areas.map(area => area / totalArea);
    console.log(probabilities)
    // Randomly choose a polygon based on its relative area
    const randomChoice = Math.random();
    let cumulativeProbability = 0;

    for (let i = 0; i < polygons.length; i++) {
      cumulativeProbability += probabilities[i];
      if (randomChoice <= cumulativeProbability) {
        selectedPolygon = polygons[i];
        break
      }
    }
  } else {
    throw new Error("Unsupported geometry type");
  }
  
  const randomPointResult = getRandomPointInPolygon(selectedPolygon);
  //console.log(randomPointResult.geometry.coordinates)
  return [randomPointResult, countryISO];
}

function getRandomPointInPolygon(polygon) {
  while (true) {
    const bboxCoords = turf.bbox(polygon); 
    const randomPointResult = turf.randomPoint(1, { bbox: bboxCoords }).features[0];
    if (turf.booleanPointInPolygon(randomPointResult, polygon)) { 
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
