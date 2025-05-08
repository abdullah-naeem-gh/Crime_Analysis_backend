/**
 * Pathfinding algorithm implementation for finding the safest path
 * based on crime data and geographic locations
 */

// Define grid dimensions and coordinates for Islamabad area
const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;
const LAT_MIN = 33.5;
const LAT_MAX = 33.8;
const LNG_MIN = 72.9;
const LNG_MAX = 73.2;

/**
 * Create a grid representation of the city
 * @returns {Array<Array>} 2D grid with base costs
 */
export function createCityGrid() {
  const grid = [];
  
  // Initialize grid with default movement cost of 1
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({
        x,
        y,
        cost: 1, // Base movement cost
        lat: LAT_MIN + (LAT_MAX - LAT_MIN) * (y / GRID_HEIGHT),
        lng: LNG_MIN + (LNG_MAX - LNG_MIN) * (x / GRID_WIDTH),
        crimeCount: 0,
      });
    }
    grid.push(row);
  }
  
  return grid;
}

/**
 * Add crime data as weights to the grid
 * @param {Array<Array>} grid - The city grid
 * @param {Array} crimeData - Crime incident data with coordinates
 * @returns {Array<Array>} Updated grid with crime weights
 */
export function addCrimeWeightsToGrid(grid, crimeData) {
  if (!crimeData || !crimeData.length) {
    console.warn('No crime data provided for path calculation');
    return grid;
  }

  // For each crime incident, increase the "cost" of nearby grid cells
  crimeData.forEach(crime => {
    let lat, lng;
    
    // Handle different data structures that might come from the API
    if (crime.crime_locations) {
      lat = parseFloat(crime.crime_locations.latitude);
      lng = parseFloat(crime.crime_locations.longitude);
    } else if (crime.latitude !== undefined) {
      lat = parseFloat(crime.latitude);
      lng = parseFloat(crime.longitude);
    } else {
      return; // Skip if no valid coordinates
    }
    
    // Skip if coordinates are outside our grid bounds
    if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
      return;
    }
    
    // Calculate grid position based on coordinates
    const gridY = Math.floor(((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * GRID_HEIGHT);
    const gridX = Math.floor(((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * GRID_WIDTH);
    
    // Safety checks
    if (gridY < 0 || gridY >= GRID_HEIGHT || gridX < 0 || gridX >= GRID_WIDTH) {
      return;
    }
    
    // Add crime weight to this cell and nearby cells in a 3x3 grid
    const crimeImpactRadius = 3;
    const crimeSeverityWeight = getCrimeSeverityWeight(crime);
    
    for (let y = Math.max(0, gridY - crimeImpactRadius); y <= Math.min(GRID_HEIGHT - 1, gridY + crimeImpactRadius); y++) {
      for (let x = Math.max(0, gridX - crimeImpactRadius); x <= Math.min(GRID_WIDTH - 1, gridX + crimeImpactRadius); x++) {
        // Calculate distance-based weight (closer = higher weight)
        const distance = Math.sqrt(Math.pow(gridY - y, 2) + Math.pow(gridX - x, 2));
        if (distance <= crimeImpactRadius) {
          const impact = crimeSeverityWeight * (1 - distance / (crimeImpactRadius + 1));
          grid[y][x].cost += impact;
          grid[y][x].crimeCount += 1;
        }
      }
    }
  });
  
  return grid;
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
 * Calculate Manhattan distance heuristic
 * @param {Object} a - First point {x, y}
 * @param {Object} b - Second point {x, y}
 * @returns {number} Manhattan distance between points
 */
function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * A* pathfinding algorithm
 * @param {Array<Array>} weightedGrid - Grid with crime weights
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} endPoint - Ending coordinates {lat, lng}
 * @returns {Array} Path as array of coordinate points
 */
export function findSafestPath(weightedGrid, startPoint, endPoint) {
  // Convert lat/lng to grid coordinates
  const start = {
    x: Math.floor(((startPoint.lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * GRID_WIDTH),
    y: Math.floor(((startPoint.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * GRID_HEIGHT)
  };
  
  const end = {
    x: Math.floor(((endPoint.lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * GRID_WIDTH),
    y: Math.floor(((endPoint.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * GRID_HEIGHT)
  };
  
  // Validate start/end points are within grid
  if (start.x < 0 || start.x >= GRID_WIDTH || start.y < 0 || start.y >= GRID_HEIGHT ||
      end.x < 0 || end.x >= GRID_WIDTH || end.y < 0 || end.y >= GRID_HEIGHT) {
    console.error('Start or end point outside grid boundaries');
    return [];
  }
  
  // A* algorithm implementation
  const openSet = [start];
  const closedSet = new Set();
  const cameFrom = {};
  
  // Initialize g-scores (cost from start to current) and f-scores (g-score + heuristic)
  const gScore = {};
  const fScore = {};
  
  // Convert x,y coordinates to string keys
  const key = (point) => `${point.x},${point.y}`;
  
  // Set initial values
  gScore[key(start)] = 0;
  fScore[key(start)] = manhattanDistance(start, end);
  
  while (openSet.length > 0) {
    // Find node in openSet with lowest fScore
    let current = openSet.reduce((lowest, node) => {
      if (fScore[key(node)] < fScore[key(lowest)]) return node;
      return lowest;
    }, openSet[0]);
    
    // If we reached the end, reconstruct and return the path
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(cameFrom, current, weightedGrid);
    }
    
    // Remove current from openSet and add to closedSet
    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(key(current));
    
    // Check all neighbors (4 directions: up, right, down, left)
    const neighbors = [
      { x: current.x, y: current.y - 1 }, // Up
      { x: current.x + 1, y: current.y }, // Right
      { x: current.x, y: current.y + 1 }, // Down
      { x: current.x - 1, y: current.y }  // Left
    ];
    
    for (const neighbor of neighbors) {
      // Skip if outside grid boundaries
      if (neighbor.x < 0 || neighbor.x >= GRID_WIDTH || 
          neighbor.y < 0 || neighbor.y >= GRID_HEIGHT) {
        continue;
      }
      
      const neighborKey = key(neighbor);
      
      // Skip if in closedSet
      if (closedSet.has(neighborKey)) {
        continue;
      }
      
      // Calculate tentative g-score through current node
      const tentativeGScore = gScore[key(current)] + weightedGrid[neighbor.y][neighbor.x].cost;
      
      // Add neighbor to openSet if not there
      if (!openSet.some(n => key(n) === neighborKey)) {
        openSet.push(neighbor);
      } 
      // Skip if this path to neighbor is not better than existing one
      else if (tentativeGScore >= (gScore[neighborKey] || Infinity)) {
        continue;
      }
      
      // This path is the best so far, record it
      cameFrom[neighborKey] = current;
      gScore[neighborKey] = tentativeGScore;
      fScore[neighborKey] = tentativeGScore + manhattanDistance(neighbor, end);
    }
  }
  
  // No path found
  console.error('No path found between the given points');
  return [];
}

/**
 * Reconstruct path from A* algorithm results
 * @param {Object} cameFrom - Map of node -> parent node
 * @param {Object} current - End node
 * @param {Array<Array>} grid - City grid with coordinate information
 * @returns {Array} Path as array of coordinate points
 */
function reconstructPath(cameFrom, current, grid) {
  const path = [];
  const key = (point) => `${point.x},${point.y}`;
  
  // Add the end point to path
  path.push({
    latitude: grid[current.y][current.x].lat,
    longitude: grid[current.y][current.x].lng
  });
  
  // Trace back the path
  while (cameFrom[key(current)]) {
    current = cameFrom[key(current)];
    path.unshift({
      latitude: grid[current.y][current.x].lat,
      longitude: grid[current.y][current.x].lng
    });
  }
  
  return path;
}

/**
 * Main function to calculate the safest path between two points
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} endPoint - Ending coordinates {lat, lng}
 * @param {Array} crimeData - Crime incident data
 * @returns {Array} Path as array of coordinate points
 */
export function calculateSafestPath(startPoint, endPoint, crimeData) {
  // 1. Create the city grid
  const grid = createCityGrid();
  
  // 2. Add crime data as weights to the grid
  const weightedGrid = addCrimeWeightsToGrid(grid, crimeData);
  
  // 3. Find the safest path using A* algorithm
  const path = findSafestPath(weightedGrid, startPoint, endPoint);
  
  return path;
}

export default {
  calculateSafestPath,
  createCityGrid,
  addCrimeWeightsToGrid,
  findSafestPath
};
