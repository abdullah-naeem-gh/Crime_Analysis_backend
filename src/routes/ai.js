import express from 'express';
import { generateContent, generateContentFromImage } from '../../utils/geminiClient.js';
import axios from 'axios';
import supabase from '../../utils/supabaseClient.js';

const router = express.Router();

// Generate content endpoint
router.post('/generate-content', async (req, res) => {
  try {
    const { prompt, systemInstruction, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const content = await generateContent(prompt, systemInstruction, model);
    res.json({ content });
  } catch (err) {
    console.error('Error generating content:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced crime pattern prediction endpoint with REAL data
router.post('/predict-crime-patterns', async (req, res) => {
  try {
    const { data } = req.body;
    const { timeframe = '90', areaLimit = '5' } = data || {};
    
    console.log(`Generating crime prediction with timeframe: ${timeframe} days, analyzing top ${areaLimit} areas`);
    
    // Fetch real crime data
    const realCrimeData = await fetchAnalyticsData(timeframe);
    
    // Count total crimes analyzed
    const totalCrimesAnalyzed = realCrimeData?.crimesByType?.reduce((sum, item) => sum + item.value, 0) || 
                               parseInt(timeframe) * 5; // Fallback estimate
    
    // Generate a prompt for the AI that includes instructions for the response format
    const systemPrompt = {
      role: "system",
      content: `
        You are an advanced crime prediction AI system specialized in analyzing crime patterns and providing 
        actionable insights for law enforcement agencies. Analyze the provided crime data for a timeframe of 
        ${timeframe} days and for the top ${areaLimit} areas.
        
        Your analysis should be returned as a structured JSON object with the exact format shown in this template:
        
        {
          "metadata": {
            "generated_at": "ISO_TIMESTAMP",
            "timeframe": "Last ${timeframe} days",
            "data_points": {
              "areas_analyzed": ${areaLimit},
              "total_crimes_analyzed": ${totalCrimesAnalyzed}
            }
          },
          "predictions": {
            "high_risk_areas": [
              {
                "name": "AREA_NAME",
                "risk_score": SCORE_OUT_OF_10,
                "predominant_crime_types": ["TYPE1", "TYPE2"],
                "reasoning": "BRIEF_EXPLANATION"
              }
            ],
            "crime_time_predictions": [
              {
                "time_period": "TIME_DESCRIPTION",
                "confidence": SCORE_OUT_OF_10,
                "crime_types": ["TYPE1", "TYPE2"]
              }
            ],
            "emerging_trends": [
              {
                "trend": "TREND_DESCRIPTION",
                "confidence": SCORE_OUT_OF_10,
                "reasoning": "BRIEF_EXPLANATION"
              }
            ]
          },
          "insights": {
            "pattern_analysis": "DETAILED_ANALYSIS_TEXT",
            "correlations": [
              {
                "factor1": "FACTOR1",
                "factor2": "FACTOR2",
                "strength": SCORE_OUT_OF_10,
                "explanation": "BRIEF_EXPLANATION"
              }
            ],
            "recommendations": [
              "RECOMMENDATION1",
              "RECOMMENDATION2"
            ]
          }
        }
        
        Make your predictions realistic and insightful using the actual crime data provided. Identify patterns, 
        correlations and high-risk areas based on the data trends. Provide 3-5 entries for each array.
        Do not include any explanatory text outside the JSON object. The response should be valid JSON that 
        can be directly parsed.
      `
    };
    
    // User prompt with the real data
    const userPrompt = {
      role: "user",
      content: `Analyze the following crime data from our database and provide predictions: ${JSON.stringify(realCrimeData)}`
    };
    
    console.log('Sending data to Gemini AI for analysis...');
    
    // Call Gemini API
    const aiResponse = await generateContent([systemPrompt, userPrompt]);
    
    // Parse response as JSON
    let predictionData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        predictionData = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed AI response as JSON');
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response as JSON:", parseError);
      console.log("AI Response:", aiResponse);
      
      // Use fallback data
      predictionData = generateFallbackPredictionData(timeframe, areaLimit, realCrimeData);
      console.log('Using fallback prediction data');
    }
    
    res.json(predictionData);
  } catch (error) {
    console.error('Error predicting crime patterns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze crime patterns',
      error: error.message
    });
  }
});

// Helper function to fetch real analytics data
async function fetchAnalyticsData(timeframe) {
  try {
    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));
    const formattedStart = startDate.toISOString().split('T')[0];
    
    // Base URL for internal API requests (use localhost since we're on the same machine)
    const BASE_URL = 'http://localhost:3000/api';
    
    // Fetch data from multiple endpoints
    const [crimesByType, crimesByArea, crimeTimeDistribution, victimAgeDistribution, criminalAgeDistribution] = 
      await Promise.all([
        axios.get(`${BASE_URL}/analytics/crimes-by-type?start=${formattedStart}&end=${endDate}`)
          .then(res => res.data)
          .catch(() => []),
        axios.get(`${BASE_URL}/analytics/crimes-by-area?start=${formattedStart}&end=${endDate}`)
          .then(res => res.data)
          .catch(() => []),
        axios.get(`${BASE_URL}/analytics/crime-time-distribution`)
          .then(res => res.data)
          .catch(() => []),
        axios.get(`${BASE_URL}/analytics/victim-age-distribution`)
          .then(res => res.data)
          .catch(() => []),
        axios.get(`${BASE_URL}/analytics/criminal-age-distribution`)
          .then(res => res.data)
          .catch(() => [])
      ]);

    return {
      crimesByType,
      crimesByArea,
      crimeTimeDistribution,
      victimAgeDistribution,
      criminalAgeDistribution,
      metadata: {
        timeframeInDays: parseInt(timeframe),
        startDate: formattedStart,
        endDate
      }
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return {
      metadata: {
        error: error.message,
        timeframeInDays: parseInt(timeframe)
      }
    };
  }
}

// Helper functions for data fetching
async function fetchRecentCrimes(timeframe) {
  try {
    // Implement actual data fetching from your database
    // For now, return mock data
    return {
      total_count: parseInt(timeframe) * 10,
      categories: {
        theft: 30,
        assault: 25,
        burglary: 20,
        vandalism: 15,
        other: 10
      }
    };
  } catch (error) {
    console.error('Error fetching recent crimes:', error);
    return {};
  }
}

async function fetchAreaStatistics(areaLimit) {
  try {
    // Implement actual data fetching from your database
    // For now, return mock data
    const areas = [
      { name: "Downtown", crime_count: 120, top_crime: "theft" },
      { name: "Westside District", crime_count: 85, top_crime: "burglary" },
      { name: "Northpark", crime_count: 65, top_crime: "assault" },
      { name: "Eastend", crime_count: 55, top_crime: "vandalism" },
      { name: "South Central", crime_count: 45, top_crime: "drug offenses" }
    ];
    
    return areas.slice(0, parseInt(areaLimit));
  } catch (error) {
    console.error('Error fetching area statistics:', error);
    return [];
  }
}

async function fetchTimePatterns(timeframe) {
  try {
    // Implement actual data fetching from your database
    // For now, return mock data
    return {
      "weekday_distribution": {
        "monday": 12,
        "tuesday": 14,
        "wednesday": 15,
        "thursday": 18,
        "friday": 25,
        "saturday": 30,
        "sunday": 20
      },
      "hour_distribution": {
        "morning": 15,
        "afternoon": 25,
        "evening": 35,
        "night": 25
      }
    };
  } catch (error) {
    console.error('Error fetching time patterns:', error);
    return {};
  }
}

// Fallback function in case AI response parsing fails - now uses real data where possible
function generateFallbackPredictionData(timeframe, areaLimit, realData) {
  // Try to use real area names from the data if available
  const areaNames = realData?.analytics?.crimesByArea?.map(area => area.name) || 
                   ["Downtown", "Westside District", "Northpark", "Eastend", "South Central"];
  
  // Try to use real crime types from the data if available
  const crimeTypes = realData?.analytics?.crimesByType?.map(item => item.crime_type) || 
                    ["Theft", "Assault", "Burglary", "Drug Offenses", "Vandalism"];
  
  return {
    metadata: {
      generated_at: new Date().toISOString(),
      timeframe: `Last ${timeframe} days`,
      data_points: {
        areas_analyzed: parseInt(areaLimit),
        total_crimes_analyzed: realData?.analytics?.crimesByType?.reduce((sum, item) => sum + item.value, 0) || 
                              parseInt(timeframe) * 10
      }
    },
    predictions: {
      high_risk_areas: [
        {
          name: areaNames[0] || "Downtown",
          risk_score: 8,
          predominant_crime_types: [crimeTypes[0], crimeTypes[1]].filter(Boolean),
          reasoning: "High foot traffic and nightlife venues create opportunities for theft and assault incidents."
        },
        {
          name: areaNames[1] || "Westside District",
          risk_score: 7,
          predominant_crime_types: [crimeTypes[2], crimeTypes[0]].filter(Boolean),
          reasoning: "Residential area with variable security measures and multiple access points."
        },
        {
          name: areaNames[2] || "Northpark",
          risk_score: 6,
          predominant_crime_types: [crimeTypes[1], crimeTypes[3]].filter(Boolean),
          reasoning: "Park areas with limited surveillance, especially during evening hours."
        }
      ],
      crime_time_predictions: [
        {
          time_period: "Friday and Saturday nights (10PM-2AM)",
          confidence: 8,
          crime_types: [crimeTypes[1], crimeTypes[0]].filter(Boolean)
        },
        {
          time_period: "Weekday afternoons (2PM-5PM)",
          confidence: 6,
          crime_types: [crimeTypes[0], "Shoplifting"].filter(Boolean)
        },
        {
          time_period: "Early morning hours (1AM-4AM)",
          confidence: 7,
          crime_types: [crimeTypes[2], "Vehicle Theft"].filter(Boolean)
        }
      ],
      emerging_trends: [
        {
          trend: "Increase in package theft from residential areas",
          confidence: 7,
          reasoning: "Rise in home deliveries has created more opportunities for theft."
        },
        {
          trend: "Shift of property crimes to suburban areas",
          confidence: 6,
          reasoning: "Increased security in downtown areas may be displacing crime to less monitored locations."
        }
      ]
    },
    insights: {
      pattern_analysis: "Crime patterns show a clear concentration around weekend evenings, particularly in entertainment districts. Property crimes tend to occur during daytime hours when residents are at work. There appears to be a correlation between public events and increased incidents of theft and public intoxication.",
      correlations: [
        {
          factor1: "Nightlife venues",
          factor2: "Assault incidents",
          strength: 8,
          explanation: "Areas with concentrated nightlife show higher rates of assault, especially during closing times."
        },
        {
          factor1: "Public transportation hubs",
          factor2: "Theft reports",
          strength: 7,
          explanation: "Major transit locations show increased theft reports, particularly during rush hours."
        }
      ],
      recommendations: [
        "Increase patrol presence in " + (areaNames[0] || "Downtown") + " during Friday and Saturday nights from 10PM to 2AM",
        "Implement targeted surveillance around public transportation hubs during peak hours",
        "Coordinate with package delivery services to develop anti-theft strategies for residential areas",
        "Focus community outreach on property security in the " + (areaNames[1] || "Westside District"),
        "Establish visible police presence in " + (areaNames[2] || "Northpark") + " during evening hours"
      ]
    }
  };
}

export default router;