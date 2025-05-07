/* eslint-disable no-unused-vars */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js'

config();

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

// Validate that we have the required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  process.exit(1);
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  // Add global error handler
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        timeout: 20000, // Increase timeout to 20 seconds
      });
    },
  },
});

// Verify the connection works
async function checkSupabaseConnection() {
  try {
    // A simple query to test the connection
    const { data, error } = await supabase.from('victims').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return false;
    }
    
    console.log('Successfully connected to Supabase');
    return true;
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
    return false;
  }
}

// Execute the check but don't wait for it - this avoids blocking the server startup
checkSupabaseConnection();

export default supabase;