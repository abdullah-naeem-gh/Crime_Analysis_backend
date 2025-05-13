/**
 * Pathfinding algorithm implementation for finding the safest path
 * based on crime data and geographic locations using OpenRouteService API
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
/**
 * Utility functions and constants for pathfinding algorithm
 * (No additional code needed here at this time)
 */
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
    
    // First try: Get a direct route without avoidance to use as fallback
    const directRoute = await getRouteWithoutAvoidance(startPoint, endPoint);
    
    if (!directRoute || !directRoute.coordinates || directRoute.coordinates.length === 0) {
      console.error('Could not find a direct route between the given points');
      return [];
    }
    
    // Score the direct route
    const scoredDirectRoute = scoreRouteByCrimeSafety(directRoute, crimeData);
    console.log(`Direct route scored with crime impact: ${scoredDirectRoute.crimeScore.toFixed(2)}`);
    
    // If crime score is acceptable, just use this route
    const LOW_CRIME_THRESHOLD = 0.8;
    if (scoredDirectRoute.crimeScore <= LOW_CRIME_THRESHOLD) {
      console.log(`Direct route has acceptable crime score (${scoredDirectRoute.crimeScore.toFixed(2)}), using it`);
      return formatRouteForFrontend(scoredDirectRoute.coordinates);
    }
    
    // Second try: Identify high crime areas to avoid
    const avoidAreas = identifyHighCrimeAreas(crimeData);
    console.log(`Identified ${avoidAreas.length} high-crime areas to avoid`);
    
    let safeRoute;
    
    // Try route with avoid areas if there are any to avoid
    if (avoidAreas.length > 0) {
      try {
        // Get route with avoid_areas parameter
        safeRoute = await getRouteAvoidingAreas(startPoint, endPoint, avoidAreas);
        
        if (safeRoute && safeRoute.coordinates && safeRoute.coordinates.length > 0) {
          // Score the safe route
          const scoredSafeRoute = scoreRouteByCrimeSafety(safeRoute, crimeData);
          console.log(`Safe route scored with crime impact: ${scoredSafeRoute.crimeScore.toFixed(2)}`);
          
          // If safe route is better than direct route, use it
          if (scoredSafeRoute.crimeScore < scoredDirectRoute.crimeScore) {
            console.log(`Using safer route with crime score: ${scoredSafeRoute.crimeScore.toFixed(2)}`);
            return formatRouteForFrontend(scoredSafeRoute.coordinates);
          } else {
            console.log(`Safe route (${scoredSafeRoute.crimeScore.toFixed(2)}) not better than direct route (${scoredDirectRoute.crimeScore.toFixed(2)}), using direct route`);
            return formatRouteForFrontend(scoredDirectRoute.coordinates);
          }
        }
      } catch (avoidError) {
        console.error('Error getting route with avoid areas:', avoidError.message);
        // Continue to fallback
      }
    }
    
    // Third try: If all else fails or no improvement, use direct route as fallback
    console.log(`Using direct route as fallback with crime score: ${scoredDirectRoute.crimeScore.toFixed(2)}`);
    return formatRouteForFrontend(directRoute.coordinates);
  } catch (error) {
    console.error('Error in calculateSafestPath:', error);
    throw error;
  }
}

/**
 * Identify high crime areas that should be avoided
 * @param {Array} crimeData - Crime incident data
 * @returns {Array} Areas to avoid, formatted for OpenRouteService API
 */
function identifyHighCrimeAreas(crimeData) {
  if (!crimeData || crimeData.length === 0) {
    return [];
  }
  
  console.log(`Processing ${crimeData.length} crime data points to identify high-risk areas`);
  
  // Create a grid to identify crime clusters
  const grid = {};
  const GRID_SIZE = 0.002; // Approximately 200m grid squares (increased for better clustering)
  
  // Count crimes in each grid cell
  crimeData.forEach(crime => {
    let lat, lng, severity;
    
    // Extract coordinates from various crime data formats
    if (crime.crime_locations) {
      lat = parseFloat(crime.crime_locations.latitude);
      lng = parseFloat(crime.crime_locations.longitude);
    } else if (crime.latitude !== undefined) {
      lat = parseFloat(crime.latitude);
      lng = parseFloat(crime.longitude);
    } else {
      return;
    }
    
    // Skip if coordinates are invalid
    if (isNaN(lat) || isNaN(lng)) {
      return;
    }
    
    severity = getCrimeSeverityWeight(crime);
    
    // Calculate grid cell
    const gridX = Math.floor(lng / GRID_SIZE);
    const gridY = Math.floor(lat / GRID_SIZE);
    const gridKey = `${gridX}:${gridY}`;
    
    if (!grid[gridKey]) {
      grid[gridKey] = {
        count: 0,
        totalSeverity: 0,
        centerLat: lat,
        centerLng: lng,
        crimes: []
      };
    } else {
      // Update cell center based on weighted average
      const cellWeight = grid[gridKey].totalSeverity;
      const newWeight = cellWeight + severity;
      grid[gridKey].centerLat = (grid[gridKey].centerLat * cellWeight + lat * severity) / newWeight;
      grid[gridKey].centerLng = (grid[gridKey].centerLng * cellWeight + lng * severity) / newWeight;
    }
    
    grid[gridKey].count++;
    grid[gridKey].totalSeverity += severity;
    grid[gridKey].crimes.push({
      lat, 
      lng, 
      type: crime.crime_type || 'unknown',
      severity
    });
  });
  
  // Identify high crime clusters - Adjust thresholds based on your specific crime data
  const HIGH_CRIME_THRESHOLD = 1; // Minimum crimes to consider a high-crime area
  const HIGH_SEVERITY_THRESHOLD = 4; // Or based on severity
  
  // Array to store avoid areas sorted by priority
  const avoidAreas = [];
  
  // First pass: identify high crime cells
  for (const gridKey in grid) {
    const cell = grid[gridKey];
    
    if (cell.count >= HIGH_CRIME_THRESHOLD || cell.totalSeverity >= HIGH_SEVERITY_THRESHOLD) {
      // Calculate radius based on crime density and severity
      const radius = Math.min(0.5, calculateAvoidanceRadius(cell.count, cell.totalSeverity));
      
      // Create polygon with priority based on severity/count
      const priority = cell.totalSeverity + (cell.count * 2);
      
      avoidAreas.push({
        polygon: createCircularPolygon(cell.centerLat, cell.centerLng, radius),
        priority: priority,
        count: cell.count,
        severity: cell.totalSeverity
      });
    }
  }
  
  // Sort avoid areas by priority (highest first)
  avoidAreas.sort((a, b) => b.priority - a.priority);
  
  // Get just the polygons, in priority order
  return avoidAreas.map(area => area.polygon);
}

/**
 * Calculate appropriate avoidance radius based on crime density and severity
 * @param {number} crimeCount - Number of crimes in area
 * @param {number} totalSeverity - Total severity score
 * @returns {number} Radius in kilometers
 */
function calculateAvoidanceRadius(crimeCount, totalSeverity) {
  // Base radius of 100 meters
  let radius = 0.1;
  
  // Increase radius based on crime count and severity
  radius += Math.min(0.2, crimeCount * 0.02); // Up to 200m more based on count
  radius += Math.min(0.3, totalSeverity * 0.01); // Up to 300m more based on severity
  
  return radius; // Return radius in kilometers
}

/**
 * Create a circular polygon for API avoid_polygons parameter
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} GeoJSON polygon feature
 */
function createCircularPolygon(centerLat, centerLng, radiusKm) {
  const points = 16; // Number of points to approximate the circle
  const coords = [];
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    
    // Convert dx/dy to longitude/latitude
    const lat = centerLat + (dy / 111.32); // 1 degree latitude = 111.32 km
    const lng = centerLng + (dx / (111.32 * Math.cos(centerLat * Math.PI / 180))); // Adjust for latitude
    
    coords.push([lng, lat]);
  }
  
  // Close the polygon
  coords.push(coords[0]);
  
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords]
    }
  };
}

/**
 * Expand avoid areas for more aggressive avoidance
 * @param {Array} avoidAreas - Original avoid areas
 * @param {Array} crimeData - Crime data
 * @returns {Array} Expanded avoid areas
 */
function expandAvoidAreas(avoidAreas, crimeData) {
  // Increase radius of existing avoid areas by 50%
  const expandedAreas = avoidAreas.map(area => {
    const coords = area.geometry.coordinates[0];
    const centerLat = coords.reduce((sum, point) => sum + point[1], 0) / coords.length;
    const centerLng = coords.reduce((sum, point) => sum + point[0], 0) / coords.length;
    
    // Estimate current radius by average distance from center
    const currentRadius = coords.reduce((sum, point) => {
      return sum + calculateDistance(centerLat, centerLng, point[1], point[0]) / 1000;
    }, 0) / coords.length;
    
    // Expand by 50%
    return createCircularPolygon(centerLat, centerLng, currentRadius * 1.5);
  });
  
  // Add additional areas for medium-crime locations
  const MEDIUM_CRIME_THRESHOLD = 1;
  const MEDIUM_SEVERITY_THRESHOLD = 5;
  
  // Create a grid to identify medium crime clusters
  const grid = {};
  const GRID_SIZE = 0.001;
  
  crimeData.forEach(crime => {
    let lat, lng, severity;
    
    if (crime.crime_locations) {
      lat = parseFloat(crime.crime_locations.latitude);
      lng = parseFloat(crime.crime_locations.longitude);
    } else if (crime.latitude !== undefined) {
      lat = parseFloat(crime.latitude);
      lng = parseFloat(crime.longitude);
    } else {
      return;
    }
    
    severity = getCrimeSeverityWeight(crime);
    
    const gridX = Math.floor(lng / GRID_SIZE);
    const gridY = Math.floor(lat / GRID_SIZE);
    const gridKey = `${gridX}:${gridY}`;
    
    if (!grid[gridKey]) {
      grid[gridKey] = {
        count: 0,
        totalSeverity: 0,
        centerLat: lat,
        centerLng: lng
      };
    } else {
      const cellWeight = grid[gridKey].totalSeverity;
      const newWeight = cellWeight + severity;
      grid[gridKey].centerLat = (grid[gridKey].centerLat * cellWeight + lat * severity) / newWeight;
      grid[gridKey].centerLng = (grid[gridKey].centerLng * cellWeight + lng * severity) / newWeight;
    }
    
    grid[gridKey].count++;
    grid[gridKey].totalSeverity += severity;
  });
  
  // Add medium crime areas
  for (const gridKey in grid) {
    const cell = grid[gridKey];

    if ((cell.count >= MEDIUM_CRIME_THRESHOLD || cell.totalSeverity >= MEDIUM_SEVERITY_THRESHOLD) &&
        (cell.count < HIGH_CRIME_THRESHOLD && cell.totalSeverity < HIGH_SEVERITY_THRESHOLD)) {
      
      const radius = calculateAvoidanceRadius(cell.count, cell.totalSeverity) * 0.8;
      const avoidArea = createCircularPolygon(cell.centerLat, cell.centerLng, radius);
      expandedAreas.push(avoidArea);
    }
  }
  
  return expandedAreas;
}

/**
 * Get route using OpenRouteService API with avoid_areas parameter
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Array} avoidAreas - GeoJSON polygons of areas to avoid
 * @returns {Promise<Object>} Route information
 */
async function getRouteAvoidingAreas(start, end, avoidAreas) {
  try {
    console.log(`Fetching route from OpenRouteService API with ${avoidAreas.length} avoid areas...`);
    
    // Format coordinates for OpenRouteService API
    const coordinates = [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ];
    
    // Request body for OpenRouteService API
    const requestBody = {
      coordinates: coordinates,
      format: 'geojson',
      options: {
        avoid_features: ["highways", "tollways"] // Optionally avoid highways and tollways
      },
      preference: "recommended" // Use recommended for better results
    };
    
    // Add avoid_polygons if we have areas to avoid
    if (avoidAreas.length > 0) {
      // OpenRouteService expects avoid_polygons as a GeoJSON object directly in the options
      requestBody.options.avoid_polygons = {
        type: "MultiPolygon",
        coordinates: avoidAreas.map(area => area.geometry.coordinates)
      };
    }
    
    // Call the OpenRouteService API
    const response = await axios({
      method: 'POST',
      url: `${ORS_API_URL}/driving-car/geojson`,
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml',
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      data: requestBody
    });
    
    if (!response.data || !response.data.features || response.data.features.length === 0) {
      console.warn('No routes found in API response, falling back to simple route.');
      return await getSimpleFallbackRoute(start, end);
    }
    
    // Extract route from the response
    const feature = response.data.features[0];
    return {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration
    };
  } catch (error) {
    console.error('Error fetching route with avoid_areas:', error);
    
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    
    console.log('Falling back to standard route without avoid_areas...');
    return getRouteWithoutAvoidance(start, end);
  }
}

/**
 * Get route without avoid areas
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Route information
 */
/**
 * Get route without avoid areas
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Route information
 */
async function getRouteWithoutAvoidance(start, end) {
  try {
    console.log(`Fetching standard route from OpenRouteService API...`);
    console.log(`Route from ${start.lat},${start.lng} to ${end.lat},${end.lng}`);
    
    // Validate coordinates first
    if (!validateCoordinates(start.lat, start.lng) || !validateCoordinates(end.lat, end.lng)) {
      throw new Error('Invalid coordinates provided for routing');
    }
    
    // Format coordinates for OpenRouteService API - [longitude, latitude] format!
    const coordinates = [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ];
    
    // Request body for OpenRouteService API
    const requestBody = {
      coordinates: coordinates,
      format: 'geojson',
      preference: "recommended", // Use recommended for better results
      instructions: false // Optional, simplifies the response
    };
    
    console.log('Request payload:', JSON.stringify(requestBody, null, 2));
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Call the OpenRouteService API with retries
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        response = await axios({
          method: 'POST',
          url: `${ORS_API_URL}/driving-car/geojson`,
          headers: {
            'Accept': 'application/json, application/geo+json',
            'Authorization': ORS_API_KEY,
            'Content-Type': 'application/json; charset=utf-8'
          },
          data: requestBody,
          timeout: 15000 // 15 second timeout
        });
        
        console.log('API response status:', response.status);
        break;
      } catch (err) {
        retries--;
        const errorMessage = err.response?.data?.error?.message || err.message;
        console.error(`API request failed (${retries} retries left): ${errorMessage}`);
        
        if (err.response?.data) {
          console.error('Response data:', JSON.stringify(err.response.data, null, 2));
        }
        
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!response.data || !response.data.features || response.data.features.length === 0) {
      console.error('API response format unexpected:', JSON.stringify(response.data, null, 2));
      throw new Error('No routes found in API response');
    }
    
    // Extract route from the response
    const feature = response.data.features[0];
    
    // Validate the response has the expected structure
    if (!feature.geometry?.coordinates || !feature.properties?.summary) {
      console.error('Invalid route data structure:', JSON.stringify(feature, null, 2));
      throw new Error('Invalid route data received from API');
    }
    
    return {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration
    };
  } catch (error) {
    console.error('Error fetching standard route:', error.message);
    
    if (error.response && error.response.data) {
      console.error('API response error:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Try alternative API endpoint format if the first one failed
    try {
      console.log('Trying alternative API endpoint format...');
      return await getRouteUsingAlternativeEndpoint(start, end);
    } catch (altError) {
      console.error('Alternative endpoint also failed:', altError.message);
      
      // Try a simpler fallback method as last resort
      try {
        return await getSimpleFallbackRoute(start, end);
      } catch (fallbackError) {
        console.error('Fallback route also failed:', fallbackError.message);
        throw new Error(`Failed to get any route: ${error.message}`);
      }
    }
  }
}

/**
 * Try an alternative endpoint format for OpenRouteService
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Promise<Object>} Route information
 */
async function getRouteUsingAlternativeEndpoint(start, end) {
  try {
    console.log('Trying alternative API endpoint format...');
    
    // Format coordinates for OpenRouteService API
    const coordinates = [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ];
    
    // Request body for OpenRouteService API
    const requestBody = {
      coordinates: coordinates,
      instructions: false,
      preference: "recommended"
    };
    
    // Call the OpenRouteService API
    const response = await axios({
      method: 'POST',
      url: `${ORS_API_URL}/driving-car`,  // Different endpoint format
      headers: {
        'Accept': 'application/json',
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      data: requestBody,
      timeout: 15000
    });
    
    if (!response.data || !response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes found in alternative API response');
    }
    
    // Extract route from the response (different structure)
    const route = response.data.routes[0];
    return {
      coordinates: route.geometry.coordinates || decodeGeometry(route.geometry),
      distance: route.summary.distance,
      duration: route.summary.duration
    };
  } catch (error) {
    console.error('Error with alternative endpoint:', error.message);
    throw error;
  }
}

/**
 * Validate coordinates are within valid ranges
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} Whether coordinates are valid
 */
function validateCoordinates(lat, lng) {
  // Check if coordinates are numbers and in valid ranges
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }
  
  const isValid = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!isValid) {
    console.error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
  }
  return isValid;
}

/**
 * Helper function to decode polyline geometry if needed
 * @param {string} encodedGeometry - Encoded polyline
 * @returns {Array} Array of coordinate pairs
 */
function decodeGeometry(encodedGeometry) {
  // Implementation of polyline decoder if needed
  // This is placeholder since the API might return encoded polylines
  console.log('Geometry decoding would happen here if needed');
  return [];
}

/**
 * Get a very simple route as a last resort
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Object} Basic route
 */
async function getSimpleFallbackRoute(start, end) {
  console.log('Using last resort simple route generation...');
  
  // If all else fails, create a direct line between points
  return {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ],
    distance: calculateDistance(start.lat, start.lng, end.lat, end.lng),
    duration: 0 // Unknown duration
  };
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
  let highRiskSegments = 0;
  const SEGMENT_RISK_THRESHOLD = 5; // Threshold to consider a segment high-risk
  
  // For each segment of the route, check proximity to crime locations
  for (let i = 0; i < route.coordinates.length; i++) {
    const point = route.coordinates[i];
    const [lng, lat] = point;
    
    let segmentScore = 0;
    
    // Check each crime location's distance to this point
    for (let j = 0; j < crimeCoordinates.length; j++) {
      const crime = crimeCoordinates[j];
      const distance = calculateDistance(lat, lng, crime.lat, crime.lng);
      
      // Improved crime influence calculation:
      // - Use exponential decay instead of linear
      // - Consider crimes up to 1000m but with rapidly diminishing influence
      if (distance <= 1200) {
        // Exponential decay: impact = severity * e^(-distance/300)
        // This makes closer crimes much more impactful
        const impact = crime.severity * Math.exp(-distance / 200);
        segmentScore += impact;
      }
    }
    
    crimeScore += segmentScore;
    
    // Count high-risk segments for additional weighting
    if (segmentScore > SEGMENT_RISK_THRESHOLD) {
      highRiskSegments++;
    }
  }
  
  // Normalize score by route length
  let normalizedScore = crimeScore / route.coordinates.length;
  
  // Apply additional penalty for routes with many high-risk segments
  // This helps avoid routes that pass through multiple high-crime areas
  const highRiskRatio = highRiskSegments / route.coordinates.length;
  normalizedScore *= (1 + highRiskRatio * 3);
  
  console.log(`Route has ${highRiskSegments} high-risk segments out of ${route.coordinates.length} total (${(highRiskRatio * 100).toFixed(1)}%)`);
  
  return {
    ...route,
    crimeScore: normalizedScore,
    highRiskSegments,
    highRiskRatio
  };
}

/**
 * Get weight multiplier based on crime type/severity
 * @param {Object} crime - Crime data object
 * @returns {number} Weight multiplier
 */
function getCrimeSeverityWeight(crime) {
  const crimeType = (crime.crime_type || '').toLowerCase();
  
  // Assign weights by crime severity - increased weights
  if (['homicide', 'murder', 'assault', 'robbery', 'rape'].includes(crimeType)) {
    return 22; // Violent crimes have highest weight
  } else if (['theft', 'burglary', 'auto theft'].includes(crimeType)) {
    return 11; // Property crimes have medium weight
  } else {
    return 5; // Other crimes have lower weight
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
 * @returns {Array} Route formatted for frontend
 */
function formatRouteForFrontend(coordinates) {
  // Convert [longitude, latitude] to {latitude, longitude} for the frontend
  // Add validation and error checks
  if (!coordinates || coordinates.length === 0) {
    return [];
  }

  return coordinates.map(point => {
    // Validate each coordinate point
    if (!Array.isArray(point) || point.length < 2) {
      console.warn('Invalid coordinate point:', point);
      return null;
    }
    return {
      longitude: Number(point[0]),
      latitude: Number(point[1])
    };
  }).filter(point => point !== null); // Remove any invalid points
}

export default {
  calculateSafestPath
};