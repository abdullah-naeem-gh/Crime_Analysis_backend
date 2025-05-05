import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js'; // Your Supabase client configuration

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base route
app.get('/', (req, res) => {
  res.send('Server is running...');
});

app.get('/api/crimes', async (req, res) => {
  const { data, error } = await supabase.from('crimes').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// Create endpoints for '/api/criminals' and '/api/victims'
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});