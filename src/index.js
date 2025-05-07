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

// Add new criminal to Supabase
app.post('/api/criminals', async (req, res) => {
  try {
    const { name, age, address } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
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
      return res.status(500).json({ error: error.message });
    }
    
    res.status(201).json(data);
  } catch (err) {
    console.error('Error adding criminal:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});