import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js'; // Your Supabase client configuration
import client, { connectToMongoDB } from '../utils/mongodbClient.js'; // MongoDB client
import analyticsRoutes from './routes/analytics.js'; // Import analytics routes
import aiRoutes from './routes/ai.js'; // Import AI routes
// Add the new import for safe path routes
import safePathRoutes from './routes/safePath.js';

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

// Mount routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
// Add the new route for safe path calculation
app.use('/api', safePathRoutes);

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
    const { 
      title, 
      description, 
      images = [], 
      location, 
      tags = [], 
      user_id
    } = req.body;

    // Validation
    if (!title || !description || !user_id) {
      return res.status(400).json({ error: 'Title, description, and User ID are required' });
    }

    const database = client.db('database1');
    const collection = database.collection('community_reports');
    
    const report = { 
      title,
      description,
      timestamp: new Date(),
      images,
      location: location || {},
      tags,
      user_id,
      likes: [] // Initialize empty likes array
    };
    
    const result = await collection.insertOne(report);

    // Return the inserted report with its ID
    res.status(201).json({
      ...result,
      document: report
    });
  } catch (err) {
    console.error('Error adding report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/community-reports/:id', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const database = client.db('database1');
    const collection = database.collection('community_reports');
    
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 1) {
      res.status(204).send(); // Successful deletion, no content
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (err) {
    console.error('Error deleting report:', err);
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
    console.error('Error fetching community reports:', err);
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

// Endpoint to add a new comment to a community report
app.post('/api/community-reports/:id/comments', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const reportId = req.params.id;
    const { user_id, comment } = req.body;

    // Validation
    if (!comment || !user_id) {
      return res.status(400).json({ error: 'Comment text and user ID are required' });
    }

    // Validate report exists
    const database = client.db('database1');
    const reportsCollection = database.collection('community_reports');
    
    const reportExists = await reportsCollection.findOne({ _id: new ObjectId(reportId) });
    if (!reportExists) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const commentsCollection = database.collection('report_comments');
    
    const commentDoc = {
      report_id: new ObjectId(reportId),
      user_id,
      comment,
      timestamp: new Date(),
      parent_comment_id: null, // Root level comment
      likes: []
    };
    
    const result = await commentsCollection.insertOne(commentDoc);

    // Return the created comment with its ID
    res.status(201).json({
      ...result,
      document: commentDoc
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to retrieve all comments for a report (including threaded replies)
app.get('/api/community-reports/:id/comments', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const reportId = req.params.id;
    const database = client.db('database1');
    const commentsCollection = database.collection('report_comments');
    
    const comments = await commentsCollection
      .find({ report_id: new ObjectId(reportId) })
      .sort({ timestamp: 1 }) // Oldest first, can change to -1 for newest first
      .toArray();
    
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to add a reply to an existing comment
app.post('/api/community-reports/:reportId/comments/:commentId/reply', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { reportId, commentId } = req.params;
    const { user_id, comment } = req.body;

    // Validation
    if (!comment || !user_id) {
      return res.status(400).json({ error: 'Comment text and user ID are required' });
    }

    // Validate parent comment exists
    const database = client.db('database1');
    const commentsCollection = database.collection('report_comments');
    
    const parentComment = await commentsCollection.findOne({ _id: new ObjectId(commentId) });
    if (!parentComment) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }

    const replyDoc = {
      report_id: new ObjectId(reportId),
      user_id,
      comment,
      timestamp: new Date(),
      parent_comment_id: new ObjectId(commentId),
      likes: []
    };
    
    const result = await commentsCollection.insertOne(replyDoc);

    // Return the created reply
    res.status(201).json({
      ...result,
      document: replyDoc
    });
  } catch (err) {
    console.error('Error adding reply:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to like a comment
app.put('/api/community-reports/:reportId/comments/:commentId/like', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { commentId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const database = client.db('database1');
    const commentsCollection = database.collection('report_comments');
    
    // Add user_id to likes array if not already present
    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId), likes: { $ne: user_id } },
      { $addToSet: { likes: user_id } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Get updated comment
    const updatedComment = await commentsCollection.findOne({ _id: new ObjectId(commentId) });
    res.json(updatedComment);
  } catch (err) {
    console.error('Error liking comment:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to unlike a comment
app.put('/api/community-reports/:reportId/comments/:commentId/unlike', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { commentId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const database = client.db('database1');
    const commentsCollection = database.collection('report_comments');
    
    // Remove user_id from likes array
    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      { $pull: { likes: user_id } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Get updated comment
    const updatedComment = await commentsCollection.findOne({ _id: new ObjectId(commentId) });
    res.json(updatedComment);
  } catch (err) {
    console.error('Error unliking comment:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to like a community report
app.put('/api/community-reports/:id/like', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const reportId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const database = client.db('database1');
    const reportsCollection = database.collection('community_reports');
    
    // Check if report exists
    const reportExists = await reportsCollection.findOne({ _id: new ObjectId(reportId) });
    if (!reportExists) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // First ensure likes field exists if not already
    if (!reportExists.likes) {
      await reportsCollection.updateOne(
        { _id: new ObjectId(reportId) },
        { $set: { likes: [] } }
      );
    }
    
    // Now add user_id to likes array if not already present
    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      { $addToSet: { likes: user_id } }
    );

    // Get updated report with like count
    const updatedReport = await reportsCollection.findOne(
      { _id: new ObjectId(reportId) },
      { projection: { likes: 1, title: 1, timestamp: 1 } }
    );
    
    res.json({
      ...updatedReport,
      likeCount: updatedReport.likes ? updatedReport.likes.length : 0
    });
  } catch (err) {
    console.error('Error liking report:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to unlike a community report
app.put('/api/community-reports/:id/unlike', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const reportId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const database = client.db('database1');
    const reportsCollection = database.collection('community_reports');
    
    // Check if report exists
    const reportExists = await reportsCollection.findOne({ _id: new ObjectId(reportId) });
    if (!reportExists) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // First ensure likes field exists if not already
    if (!reportExists.likes) {
      await reportsCollection.updateOne(
        { _id: new ObjectId(reportId) },
        { $set: { likes: [] } }
      );
    }
    
    // Remove user_id from likes array
    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      { $pull: { likes: user_id } }
    );

    // Get updated report with like count
    const updatedReport = await reportsCollection.findOne(
      { _id: new ObjectId(reportId) },
      { projection: { likes: 1, title: 1, timestamp: 1 } }
    );
    
    res.json({
      ...updatedReport,
      likeCount: updatedReport.likes ? updatedReport.likes.length : 0
    });
  } catch (err) {
    console.error('Error unliking report:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to get comment count for a community report
app.get('/api/community-reports/:id/comment-count', async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const reportId = req.params.id;
    const database = client.db('database1');
    const commentsCollection = database.collection('report_comments');
    
    // Count all comments associated with this report
    const commentCount = await commentsCollection.countDocuments({ 
      report_id: new ObjectId(reportId) 
    });
    
    // Return the count in a simple JSON structure
    res.json({ 
      report_id: reportId,
      comment_count: commentCount
    });
  } catch (err) {
    console.error('Error fetching comment count:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Endpoint to create a new police station
app.post('/api/stations', async (req, res) => {
  console.log('POST request received at /api/stations', req.body);
  try {
    const { station_name, address, latitude, longitude } = req.body;
    
    // Validation
    if (!station_name || !address || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Station name, address, latitude, and longitude are required' 
      });
    }
    
    console.log('Processing station insertion with location data');

    // Use retry operation for better reliability
    const result = await retryOperation(async () => {
      // Insert directly into stations table with coordinates
      const { data: stationData, error: stationError } = await supabase
        .from('stations')
        .insert({ 
          station_name, 
          address, 
          latitude,
          longitude
        })
        .select();

      if (stationError) {
        console.error('Station insert error:', stationError);
        throw new Error(stationError.message);
      }

      const stationId = stationData[0].station_id;
      console.log('Station processed:', stationId);

      // Return station data
      return stationData[0];
    });

    console.log('Station created successfully');
    res.status(201).json({ 
      message: 'Station created successfully', 
      data: result 
    });
  } catch (err) {
    console.error('Error creating station:', err);
    res.status(500).json({ 
      error: 'Internal server error while creating station: ' + err.message 
    });
  }
});

// Endpoint to get all police stations
app.get('/api/stations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stations')
      .select('*');
    
    if (error) {
      console.error('Error fetching stations:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error in stations endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to update a police station
app.put('/api/stations/:id', async (req, res) => {
  console.log(`PUT request received at /api/stations/${req.params.id}`, req.body);
  try {
    const { id } = req.params;
    const { station_name, address, latitude, longitude } = req.body;
    
    // Validation
    if (!station_name || !address) {
      return res.status(400).json({ error: 'Station name and address are required' });
    }
    
    console.log('Updating station in Supabase:', { id, station_name, address, latitude, longitude });
    
    // Update in Supabase with retry
    const result = await retryOperation(async () => {
      // Update all fields at once
      const updateData = { 
        station_name, 
        address
      };
      
      // Only include coordinates if they were provided
      if (latitude !== undefined) updateData.latitude = latitude;
      if (longitude !== undefined) updateData.longitude = longitude;
      
      // Update station with all provided fields
      const { data, error } = await supabase
        .from('stations')
        .update(updateData)
        .eq('station_id', id)
        .select();
        
      if (error) {
        console.error('Station update error:', error);
        throw new Error(error.message || 'Station update failed');
      }
      
      if (!data || data.length === 0) {
        throw new Error('Station not found');
      }
      
      return data[0];
    });
    
    console.log('Station updated successfully:', result);
    res.json(result);
  } catch (err) {
    console.error('Error updating station:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Endpoint to delete a police station
app.delete('/api/stations/:id', async (req, res) => {
  console.log(`DELETE request received at /api/stations/${req.params.id}`);
  try {
    const { id } = req.params;
    
    // Delete from Supabase with retry
    const result = await retryOperation(async () => {
      // Delete the station directly
      const { data, error } = await supabase
        .from('stations')
        .delete()
        .eq('station_id', id)
        .select();
        
      if (error) {
        console.error('Station delete error:', error);
        throw new Error(error.message || 'Station delete failed');
      }
      
      return { data, count: data?.length || 0 };
    });
    
    if (!result.data || result.count === 0) {
      return res.status(404).json({ error: 'Station not found or already deleted' });
    }
    
    console.log('Station deleted successfully:', result.data);
    res.status(200).json({ message: 'Station deleted successfully', data: result.data });
  } catch (err) {
    console.error('Error deleting station:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});