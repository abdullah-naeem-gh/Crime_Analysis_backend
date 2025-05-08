const express = require('express');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const router = express.Router();

// Initialize the OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/google/callback'
);

// Generate Google OAuth URL
router.get('/google', (req, res) => {
  // Generate a URL for user consent
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent'
  });
  
  // Redirect the user to Google's OAuth page
  res.redirect(authorizeUrl);
});

// Google OAuth callback route
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });
    
    const userData = await response.json();
    
    // Here you would typically:
    // 1. Check if the user exists in your database
    // 2. If not, create a new user
    // 3. Create a session or JWT token
    
    // For demonstration, sending back the user data
    res.json({
      success: true,
      message: 'Google authentication successful',
      user: userData,
      tokens: tokens
    });
    
    // Or redirect to frontend with token
    // res.redirect(`http://your-frontend-url?token=${yourGeneratedJWT}`);
    
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: req.user
    });
  }
  res.json({
    authenticated: false
  });
});

// Logout route
router.get('/logout', (req, res) => {
  // Clear any tokens or sessions
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

module.exports = router;
