import express from 'express';
import { fetchCrimeLocationsForPathfinding } from '../../utils/analyticsDataFetcher.js';
import { calculateSafestPath } from '../../utils/pathfindingAlgorithm.js';

const router = express.Router();

/**
 * POST /api/calculate-safest-path
 * Calculate the safest path between two points considering crime data
 */
router.post('/calculate-safest-path', async (req, res) => {
  try {
    const { from, to, timeframe } = req.body;
    
    // Validate the coordinates
    if (!from || !to || !from.latitude || !to.latitude || 
        !from.longitude || !to.longitude) {
      return res.status(400).json({ 
        error: 'Invalid coordinates provided. Both starting and destination points must include latitude and longitude.' 
      });
    }
    
    console.log(`Calculating safest path from [${from.latitude}, ${from.longitude}] to [${to.latitude}, ${to.longitude}]`);
    
    // Get crime data for the algorithm (last 90 days by default)
    const crimeDataTimeframe = timeframe || '90';
    const crimeData = await fetchCrimeLocationsForPathfinding(crimeDataTimeframe);
    
    console.log(`Using ${crimeData.length} crime data points for path calculation`);
    
    // Calculate the safest path using the pathfinding algorithm
    try {
      const path = await calculateSafestPath(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
        crimeData
      );
      
      if (!path || path.length === 0) {
        return res.status(404).json({ 
          error: 'No path found between the given points. They may be too far apart or unreachable.' 
        });
      }
      
      console.log(`Found path with ${path.length} points`);
      
      // Return the path
      return res.json({ 
        success: true,
        path,
        metadata: {
          crimeDataPoints: crimeData.length,
          pathPoints: path.length,
          timeframe: `${crimeDataTimeframe} days`,
          routing: 'road-based'
        }
      });
    } catch (pathError) {
      console.error('Error in path calculation:', pathError);
      
      // If OpenRouteService fails, fall back to direct path
      return res.status(500).json({ 
        error: 'Failed to calculate road-based path',
        message: pathError.message,
        suggestion: 'Try again later or with different coordinates'
      });
    }
  } catch (error) {
    console.error('Error calculating safest path:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate safest path',
      message: error.message 
    });
  }
});

export default router;
