/**
 * Pathfinding algorithm implementation for finding the safest path
 * based on crime data and geographic locations using OpenRouteService API
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Get API key from environment variables
const ORS_API_KEY = process.env.ORS_API_KEY;

if (!ORS_API_KEY) {
  console.error('ERROR: OpenRouteService API key not found in environment variables');
}

// Define constants for the OpenRouteService API
const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions';

/**
 * Main function to calculate the safest path between two points
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} endPoint - Ending coordinates {lat, lng}
 * @param {Array} crimeData - Crime incident data
 * @returns {Promise<Array>} Path as array of coordinate points
 */
export async function calculateSafestPath(startPoint, endPoint, crimeData) {
  try {
    console.log(`Calculating road-based safest path from [${startPoint.lat}, ${startPoint.lng}] to [${endPoint.lat}, ${endPoint.lng}]`);
    
    // Step 1: Get route from the routing API
    const route = await getRoute(startPoint, endPoint);
    
    if (!route || !route.coordinates || route.coordinates.length === 0) {
      console.error('No valid route found between the given points');
      return [];
    }
    
    console.log(`Received route with ${route.coordinates.length} points from OpenRouteService`);
    
    // Step 2: Score the route based on proximity to crime locations
    const scoredRoute = scoreRouteByCrimeSafety(route, crimeData);
    
    console.log(`Route scored with crime impact: ${scoredRoute.crimeScore.toFixed(2)}`);
    
    // Step 3: Format the route for frontend consumption
    return formatRouteForFrontend(scoredRoute.coordinates);
  } catch (error) {
    console.error('Error in calculateSafestPath:', error);
    throw error;
  }
}

/**
 * Get routing between two points using OpenRouteService API
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Route information
 */
async function getRoute(start, end) {
  try {
    console.log('Fetching route from OpenRouteService API...');
    
    // Format coordinates for OpenRouteService API
    const coordinates = [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ];
    
    // Call the OpenRouteService API
    const response = await axios({
      method: 'GET',
      url: `${ORS_API_URL}/driving-car`,
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml',
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      params: {
        api_key: ORS_API_KEY,
        start: `${start.lng},${start.lat}`,
        end: `${end.lng},${end.lat}`
      }
    });
    
    if (!response.data || !response.data.features || response.data.features.length === 0) {
      // Try alternative method using POST request
      return await getRouteWithPost(start, end);
    }
    
    // Extract route from the response
    const feature = response.data.features[0];
    return {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration
    };
  } catch (error) {
    console.error('Error fetching route with GET method:', error);
    
    // Try alternative method using POST request
    return await getRouteWithPost(start, end);
  }
}

/**
 * Alternative method to get route using POST request
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Route information
 */
async function getRouteWithPost(start, end) {
  try {
    console.log('Trying alternative method (POST) for OpenRouteService API...');
    
    // Format coordinates for OpenRouteService API
    const coordinates = [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ];
    
    // Request body for OpenRouteService API
    const requestBody = {
      coordinates: coordinates,
      format: 'geojson'
    };
    
    // Call the OpenRouteService API
    const response = await axios({
      method: 'POST',
      url: `${ORS_API_URL}/driving-car`,
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml',
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      data: requestBody
    });
    
    if (!response.data || !response.data.features || response.data.features.length === 0) {
      throw new Error('No routes found in API response');
    }
    
    // Extract route from the response
    const feature = response.data.features[0];
    return {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration
    };
  } catch (error) {
    console.error('Error fetching route with POST method from OpenRouteService:', error);
    
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    
    throw new Error(`Failed to get route: ${error.message}`);
  }
}

/**
 * Score route by proximity to crime locations
 * @param {Object} route - Route object with coordinates
 * @param {Array} crimeData - Crime incident data
 * @returns {Object} Scored route
 */
function scoreRouteByCrimeSafety(route, crimeData) {
  if (!crimeData || crimeData.length === 0) {
    console.warn('No crime data provided for route scoring');
    return { ...route, crimeScore: 0 };
  }
  
  // Extract crime coordinates from crime data
  const crimeCoordinates = crimeData.map(crime => {
    let lat, lng;
    
    if (crime.crime_locations) {
      lat = parseFloat(crime.crime_locations.latitude);
      lng = parseFloat(crime.crime_locations.longitude);
    } else if (crime.latitude !== undefined) {
      lat = parseFloat(crime.latitude);
      lng = parseFloat(crime.longitude);
    } else {
      return null;
    }
    
    return { lat, lng, severity: getCrimeSeverityWeight(crime) };
  }).filter(coord => coord !== null);
  
  console.log(`Scoring route with ${route.coordinates.length} points against ${crimeCoordinates.length} crime locations`);
  
  let crimeScore = 0;
  
  // For each segment of the route, check proximity to crime locations
  for (let i = 0; i < route.coordinates.length; i++) {
    const point = route.coordinates[i];
    const [lng, lat] = point;
    
    // Check each crime location's distance to this point
    for (let j = 0; j < crimeCoordinates.length; j++) {
      const crime = crimeCoordinates[j];
      const distance = calculateDistance(lat, lng, crime.lat, crime.lng);
      
      // Crime influence decreases with distance
      // Only consider crimes within 500 meters
      if (distance <= 500) {
        // Closer crimes and more severe crimes have higher impact
        // The impact formula: severity * (1 - distance/500)
        const impact = crime.severity * (1 - distance / 500);
        crimeScore += impact;
      }
    }
  }
  
  // Normalize score by route length (to avoid penalizing longer routes)
  const normalizedScore = crimeScore / route.coordinates.length;
  
  return {
    ...route,
    crimeScore: normalizedScore
  };
}

/**
 * Get weight multiplier based on crime type/severity
 * @param {Object} crime - Crime data object
 * @returns {number} Weight multiplier
 */
function getCrimeSeverityWeight(crime) {
  const crimeType = (crime.crime_type || '').toLowerCase();
  
  // Assign weights by crime severity
  if (['homicide', 'murder', 'assault', 'robbery', 'rape'].includes(crimeType)) {
    return 10; // Violent crimes have highest weight
  } else if (['theft', 'burglary', 'auto theft'].includes(crimeType)) {
    return 5; // Property crimes have medium weight
  } else {
    return 2; // Other crimes have lower weight
  }
}

/**
 * Calculate distance between coordinates in meters
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in meters
}

/**
 * Format the route for the frontend
 * @param {Array} coordinates - Array of [longitude, latitude] points
 * @returns {Array} Array of {latitude, longitude} points
 */
function formatRouteForFrontend(coordinates) {
  // Convert [longitude, latitude] to {latitude, longitude} for the frontend
  return coordinates.map(point => ({
    longitude: point[0],
    latitude: point[1]
  }));
}

export default {
  calculateSafestPath
};
