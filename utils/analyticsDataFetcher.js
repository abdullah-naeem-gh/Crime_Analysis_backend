import axios from 'axios';

// Base URL for internal API requests
const BASE_URL = 'http://localhost:3000';

// Helper to handle API errors consistently
const handleApiError = (error, endpoint) => {
  console.error(`Error fetching data from ${endpoint}:`, error);
  return null;
};

export async function fetchAllAnalyticsData(timeframe = '90') {
  try {
    const start = new Date();
    start.setDate(start.getDate() - parseInt(timeframe));
    const startDate = start.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const dateParams = `?start=${startDate}&end=${endDate}`;

    // Fetch data from multiple endpoints in parallel
    const [
      crimesByType,
      crimesByArea, 
      crimesTrend,
      crimeTimeDistribution,
      crimesVsArrests,
      victimAgeDistribution,
      criminalAgeDistribution,
      crimeAreaCorrelation,
      crimes,
      criminals,
      victims,
      crimeLocations
    ] = await Promise.all([
      // Analytics endpoints
      axios.get(`${BASE_URL}/api/analytics/crimes-by-type${dateParams}`).then(res => res.data).catch(err => handleApiError(err, 'crimes-by-type')),
      axios.get(`${BASE_URL}/api/analytics/crimes-by-area${dateParams}`).then(res => res.data).catch(err => handleApiError(err, 'crimes-by-area')),
      axios.get(`${BASE_URL}/api/analytics/crimes-trend${dateParams}`).then(res => res.data).catch(err => handleApiError(err, 'crimes-trend')),
      axios.get(`${BASE_URL}/api/analytics/crime-time-distribution`).then(res => res.data).catch(err => handleApiError(err, 'crime-time-distribution')),
      axios.get(`${BASE_URL}/api/analytics/crimes-vs-arrests${dateParams}`).then(res => res.data).catch(err => handleApiError(err, 'crimes-vs-arrests')),
      axios.get(`${BASE_URL}/api/analytics/victim-age-distribution`).then(res => res.data).catch(err => handleApiError(err, 'victim-age-distribution')),
      axios.get(`${BASE_URL}/api/analytics/criminal-age-distribution`).then(res => res.data).catch(err => handleApiError(err, 'criminal-age-distribution')),
      axios.get(`${BASE_URL}/api/analytics/crime-area-correlation`).then(res => res.data).catch(err => handleApiError(err, 'crime-area-correlation')),
      
      // Basic data endpoints
      axios.get(`${BASE_URL}/api/crimes`).then(res => res.data).catch(err => handleApiError(err, 'crimes')),
      axios.get(`${BASE_URL}/api/criminals`).then(res => res.data).catch(err => handleApiError(err, 'criminals')),
      axios.get(`${BASE_URL}/api/victims`).then(res => res.data).catch(err => handleApiError(err, 'victims')),
      axios.get(`${BASE_URL}/api/crime-locations`).then(res => res.data).catch(err => handleApiError(err, 'crime-locations'))
    ]);

    // Combine all data into a comprehensive object
    return {
      analytics: {
        crimesByType: crimesByType || [],
        crimesByArea: crimesByArea || [],
        crimesTrend: crimesTrend || [],
        crimeTimeDistribution: crimeTimeDistribution || [],
        crimesVsArrests: crimesVsArrests || [],
        victimAgeDistribution: victimAgeDistribution || [],
        criminalAgeDistribution: criminalAgeDistribution || [],
        crimeAreaCorrelation: crimeAreaCorrelation || []
      },
      rawData: {
        crimes: crimes || [],
        criminals: criminals || [],
        victims: victims || [],
        crimeLocations: crimeLocations || []
      },
      metadata: {
        dataCollectionDate: new Date().toISOString(),
        timeframeInDays: parseInt(timeframe),
        startDate,
        endDate
      }
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    // Return a minimal structure with empty arrays to prevent null errors
    return {
      analytics: {},
      rawData: {},
      metadata: {
        dataCollectionDate: new Date().toISOString(),
        error: error.message
      }
    };
  }
}

/**
 * Fetch crime location data specifically for pathfinding algorithm
 * @param {string} timeframe - Number of days to look back for crime data
 * @returns {Promise<Array>} Array of crime locations with coordinates and metadata
 */
export async function fetchCrimeLocationsForPathfinding(timeframe = '90') {
  try {
    const start = new Date();
    start.setDate(start.getDate() - parseInt(timeframe));
    const startDate = start.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const dateParams = `?start=${startDate}&end=${endDate}`;

    // Fetch crime locations with coordinates and crime type information
    const response = await axios.get(`${BASE_URL}/api/crime-locations${dateParams}`)
      .catch(err => {
        console.error('Error fetching crime locations:', err);
        return { data: [] };
      });
    
    return response.data || [];
  } catch (error) {
    console.error('Error fetching crime locations for pathfinding:', error);
    return [];
  }
}

export default { 
  fetchAllAnalyticsData,
  fetchCrimeLocationsForPathfinding
};
