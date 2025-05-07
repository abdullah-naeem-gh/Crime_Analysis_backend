import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js'; // Your Supabase client configuration
import client, { connectToMongoDB } from '../utils/mongodbClient.js'; // MongoDB client

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectToMongoDB();

// Base route
app.get('/', (req, res) => {
  res.send('Server is running...');
});

// Supabase endpoints
app.get('/api/crimes', async (req, res) => {
  const { data, error } = await supabase.from('crimes').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.get('/api/criminals', async (req, res) => {
  const { data, error } = await supabase.from('criminals').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.get('/api/victims', async (req, res) => {
  const { data, error } = await supabase.from('victims').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.get('/api/crime-locations', async (req, res) => {
  const { data, error } = await supabase
    .from('crimes')
    .select(`
      crime_id,
      crime_type,
      description,
      crime_locations (
        latitude,
        longitude
      )
    `);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.get('/api/areas', async (req, res) => {
  const { data, error } = await supabase.from('areas').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.post('/api/community-reports', async (req, res) => {
  try {
    const { content, location, is_anonymous, user_id } = req.body;

    // Validation
    if (!content || !user_id) {
      return res.status(400).json({ error: 'Content and User ID are required' });
    }

    const database = client.db('yourDatabaseName');
    const collection = database.collection('community_reports');
    const report = { content, location, is_anonymous, user_id, date: new Date() };
    
    const result = await collection.insertOne(report);

    // Directly return the inserted report
    res.status(201).json(result);
  } catch (err) {
    console.error('Error adding report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/community-reports/:id', async (req, res) => {
  try {
    const database = client.db('database1');
    const collection = database.collection('community_reports');
    const result = await collection.deleteOne({ _id: new MongoClient.ObjectId(req.params.id) });
    if (result.deletedCount === 1) {
      res.status(204).send(); // Successful deletion, no content
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch all community reports
app.get('/api/community-reports', async (req, res) => {
  try {
    const database = client.db('database1');
    const collection = database.collection('community_reports');
    const reports = await collection.find({}).toArray();
    
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new victim to Supabase
app.post('/api/victims', async (req, res) => {
  try {
    const { name, age, address } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('victims')
      .insert([{ 
        name, 
        age, 
        address 
      }])
      .select();
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(201).json(data);
  } catch (err) {
    console.error('Error adding victim:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a specific victim
app.put('/api/victims/:id', async (req, res) => {
  console.log(`PUT request received at /api/victims/${req.params.id}`, req.body);
  try {
    const { id } = req.params;
    const { name, age, address } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    console.log('Updating victim in Supabase:', { id, name, age, address });
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('victims')
      .update({ name, age, address })
      .eq('victim_id', id)
      .select();
      
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'Victim not found' });
    }
    
    console.log('Victim updated successfully:', data);
    res.json(data[0]);
  } catch (err) {
    console.error('Error updating victim:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new criminal to Supabase
app.post('/api/criminals', async (req, res) => {
  console.log('POST request received at /api/criminals', req.body);
  try {
    const { name, age, address } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    console.log('Inserting criminal into Supabase:', { name, age, address });
    // Insert into Supabase
    const { data, error } = await supabase
      .from('criminals')
      .insert([{ 
        name, 
        age, 
        address 
      }])
      .select();
      
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Criminal added successfully:', data);
    res.status(201).json(data);
  } catch (err) {
    console.error('Error adding criminal:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function for retrying Supabase operations
async function retryOperation(operation, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      return await operation();
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err);
      lastError = err;
      
      // Wait before next retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError; // All retries failed
}

// Update a specific criminal
app.put('/api/criminals/:id', async (req, res) => {
  console.log(`PUT request received at /api/criminals/${req.params.id}`, req.body);
  try {
    const { id } = req.params;
    const { name, age, address } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    console.log('Updating criminal in Supabase:', { id, name, age, address });
    
    // Update in Supabase with retry
    const data = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('criminals')
        .update({ name, age, address })
        .eq('criminal_id', id)
        .select();
        
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Supabase update failed');
      }
      
      return data;
    });
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Criminal not found' });
    }
    
    console.log('Criminal updated successfully:', data);
    res.json(data[0]);
  } catch (err) {
    console.error('Error updating criminal:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Delete a specific criminal
app.delete('/api/criminals/:id', async (req, res) => {
  console.log(`DELETE request received at /api/criminals/${req.params.id}`);
  try {
    const { id } = req.params;
    
    // Delete from Supabase with retry
    const result = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('criminals')
        .delete()
        .eq('criminal_id', id)
        .select();
        
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Supabase delete failed');
      }
      
      return { data, count: data?.length || 0 };
    });
    
    if (!result.data || result.count === 0) {
      return res.status(404).json({ error: 'Criminal not found or already deleted' });
    }
    
    console.log('Criminal deleted successfully:', result.data);
    res.status(200).json({ message: 'Criminal deleted successfully', data: result.data });
  } catch (err) {
    console.error('Error deleting criminal:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Delete a specific victim
app.delete('/api/victims/:id', async (req, res) => {
  console.log(`DELETE request received at /api/victims/${req.params.id}`);
  try {
    const { id } = req.params;
    
    // Delete from Supabase with retry
    const result = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('victims')
        .delete()
        .eq('victim_id', id)
        .select();
        
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Supabase delete failed');
      }
      
      return { data, count: data?.length || 0 };
    });
    
    if (!result.data || result.count === 0) {
      return res.status(404).json({ error: 'Victim not found or already deleted' });
    }
    
    console.log('Victim deleted successfully:', result.data);
    res.status(200).json({ message: 'Victim deleted successfully', data: result.data });
  } catch (err) {
    console.error('Error deleting victim:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Create a new crime with related entities
app.post('/api/crimes', async (req, res) => {
  console.log('POST request received at /api/crimes', req.body);
  try {
    const { crimeType, description, date, latitude, longitude, areaName, criminals, victims } = req.body;
    
    // Validation
    if (!crimeType || !description || !latitude || !longitude) {
      return res.status(400).json({ error: 'Crime type, description, latitude, and longitude are required' });
    }
    
    // Ensure criminals and victims are arrays
    const criminalIds = Array.isArray(criminals) ? criminals : [];
    const victimIds = Array.isArray(victims) ? victims : [];
    
    console.log('Processing crime insertion with related data');

    // Use retry operation for better reliability
    const result = await retryOperation(async () => {
      // First check if area exists
      let areaId;
      const area_name = areaName || 'Unknown Area';
      
      let { data: existingArea, error: findError } = await supabase
        .from('areas')
        .select('area_id')
        .eq('name', area_name)
        .limit(1);
      
      if (findError) {
        console.error('Error finding area:', findError);
        throw new Error(findError.message);
      }
      
      // If area exists, use it; otherwise insert new area
      if (existingArea && existingArea.length > 0) {
        areaId = existingArea[0].area_id;
        console.log('Using existing area:', areaId);
      } else {
        // Insert new area
        const { data: newArea, error: insertError } = await supabase
          .from('areas')
          .insert({ name: area_name })
          .select();
          
        if (insertError) {
          console.error('Area insert error:', insertError);
          throw new Error(insertError.message);
        }
        
        areaId = newArea[0].area_id;
        console.log('Created new area:', areaId);
      }

      // Insert Crime Location
      const { data: locationData, error: locationError } = await supabase
        .from('crime_locations')
        .insert({ latitude, longitude, area_id: areaId })
        .select();

      if (locationError) {
        console.error('Location insert error:', locationError);
        throw new Error(locationError.message);
      }

      const locationId = locationData[0].location_id;
      console.log('Location processed:', locationId);

      // Rest of the function remains the same
      // ...existing code...

      const { data: crimeData, error: crimeError } = await supabase
        .from('crimes')
        .insert({ 
          location_id: locationId, 
          crime_type: crimeType, 
          description, 
          date: date || new Date().toISOString() 
        })
        .select();

      if (crimeError) {
        console.error('Crime insert error:', crimeError);
        throw new Error(crimeError.message);
      }

      const crimeId = crimeData[0].crime_id;
      console.log('Crime processed:', crimeId);

      // Insert Criminal associations if any
      if (criminalIds.length > 0) {
        const crimeCriminalEntries = criminalIds.map(criminal_id => ({
          crime_id: crimeId,
          criminal_id
        }));

        const { error: criminalInsertError } = await supabase
          .from('crime_criminal')
          .insert(crimeCriminalEntries);

        if (criminalInsertError) {
          console.error('Criminal association error:', criminalInsertError);
          throw new Error(criminalInsertError.message);
        }
        
        console.log('Criminal associations processed:', criminalIds.length);
      }

      // Insert Victim associations if any
      if (victimIds.length > 0) {
        const crimeVictimEntries = victimIds.map(victim_id => ({
          crime_id: crimeId,
          victim_id
        }));

        const { error: victimInsertError } = await supabase
          .from('crime_victim')
          .insert(crimeVictimEntries);

        if (victimInsertError) {
          console.error('Victim association error:', victimInsertError);
          throw new Error(victimInsertError.message);
        }
        
        console.log('Victim associations processed:', victimIds.length);
      }

      // For returning, let's also fetch the area data
      const { data: areaData } = await supabase
        .from('areas')
        .select('*')
        .eq('area_id', areaId)
        .limit(1);

      return {
        crime: crimeData[0],
        location: locationData[0],
        area: areaData[0] || { area_id: areaId, name: area_name },
        criminals: criminalIds,
        victims: victimIds
      };
    });

    console.log('Crime created successfully with all associations');
    res.status(201).json({ 
      message: 'Crime inserted successfully', 
      data: result 
    });
  } catch (err) {
    console.error('Error inserting crime:', err);
    res.status(500).json({ 
      error: 'Internal server error while inserting crime: ' + err.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});