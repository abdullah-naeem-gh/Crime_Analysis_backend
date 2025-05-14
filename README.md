# Crime Analysis Backend

## Overview

The Crime Analysis Backend is a Node.js Express application designed to manage, analyze, and predict crime-related data. It provides a comprehensive suite of APIs for interacting with crime records, community reports, victim and criminal information, police station data, and offers advanced features like AI-powered crime pattern predictions and safest path calculations. The system integrates with Supabase (PostgreSQL) for structured relational data, MongoDB for flexible document-based data (like community reports and comments), Google Gemini for AI capabilities, OpenRouteService for pathfinding, and Redis for caching.

## Features

*   **Crime Data Management:** CRUD operations for crimes, criminals, victims, and police stations.
*   **Community Reporting System:** Allows users to submit community reports, add comments, and like reports/comments.
*   **Advanced Analytics:** Provides various endpoints to fetch aggregated crime statistics, trends, and distributions.
*   **AI-Powered Predictions:** Utilizes Google Gemini to predict crime patterns based on historical data, with results cached in Redis.
*   **Safest Path Calculation:** Calculates the safest route between two points using OpenRouteService, considering crime hotspots.
*   **Authentication:** Implements Google OAuth for user authentication.
*   **Data Fetching & Caching:** Efficiently fetches and caches data to improve performance.
*   **Database Integration:** Uses Supabase (PostgreSQL) for core relational data and MongoDB for community-generated content.

## Directory Structure
└── abdullah-naeem-gh-crime_analysis_backend/
├── package.json
├── routes/
│ └── auth.js
├── src/
│ ├── index.js
│ └── routes/
│ ├── ai.js
│ ├── analytics.js
│ └── safePath.js
└── utils/
├── analyticsDataFetcher.js
├── geminiClient.js
├── mongodbClient.js
├── pathfindingAlgorithm.js
├── redisClient.js
└── supabaseClient.js

## Technologies Used

*   **Backend Framework:** Express.js
*   **Language:** Node.js (with ES Modules)
*   **Databases:**
    *   Supabase (PostgreSQL) - For relational data (crimes, criminals, victims, stations).
    *   MongoDB - For document-based data (community reports, comments).
*   **Caching:** Redis
*   **AI/Machine Learning:** Google Gemini API
*   **Routing/Pathfinding:** OpenRouteService API
*   **Authentication:** Google OAuth 2.0
*   **HTTP Client:** Axios
*   **Environment Variables:** dotenv
*   **CORS:** cors
*   **Development Tool:** nodemon

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd abdullah-naeem-gh-crime_analysis_backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory and add the following variables with your respective credentials and configurations:

    ```env
    PORT=3000

    # Google OAuth
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

    # Supabase
    SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY

    # MongoDB
    MONGODB_URL=YOUR_MONGODB_CONNECTION_STRING

    # Google Gemini AI
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY

    # OpenRouteService
    ORS_API_KEY=YOUR_OPENROUTESERVICE_API_KEY

    # Redis
    REDIS_URL=YOUR_REDIS_CONNECTION_URL # e.g., redis://localhost:6379
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The server will typically start on `http://localhost:3000` (or the port specified in `PORT`).

5.  **Start the production server (if applicable):**
    ```bash
    npm start
    ```

## API Endpoints

The base URL for all API endpoints is `/api`.

### 1. Authentication (`routes/auth.js`)

*   **`GET /auth/google`**
    *   Description: Initiates Google OAuth authentication. Redirects the user to Google's OAuth page.
*   **`GET /auth/google/callback`**
    *   Description: Callback URL for Google OAuth. Exchanges authorization code for tokens and retrieves user info.
    *   Response: JSON with user data and tokens.
*   **`GET /auth/status`**
    *   Description: Checks if the user is currently authenticated (Note: `req.isAuthenticated()` typically requires session middleware like `express-session` and Passport.js, which are not explicitly configured in `src/index.js` for these routes. This endpoint might need further setup to function as intended with the provided code).
    *   Response: JSON with authentication status.
*   **`GET /auth/logout`**
    *   Description: Logs out the user (Note: Actual session/token clearing logic depends on the authentication strategy used).
    *   Response: JSON with success message.

### 2. Main API Routes (`src/index.js`)

*   **`GET /`**
    *   Description: Base route to check if the server is running.
    *   Response: Text "Server is running...".

*   **Supabase Data Endpoints:**
    *   **`GET /api/crimes`**: Fetches all crime records from Supabase.
    *   **`POST /api/crimes`**: Creates a new crime record along with its relations (location, criminals, victims) using a Supabase RPC (`insert_crime_with_relations`).
        *   Request Body: `{ crimeType, description, date, latitude, longitude, areaName, criminals (array of IDs), victims (array of IDs) }`
    *   **`GET /api/criminals`**: Fetches all criminal records from Supabase.
    *   **`POST /api/criminals`**: Adds a new criminal record to Supabase.
        *   Request Body: `{ name, age, address }`
    *   **`PUT /api/criminals/:id`**: Updates a specific criminal record.
        *   Request Body: `{ name, age, address }`
    *   **`DELETE /api/criminals/:id`**: Deletes a specific criminal record.
    *   **`GET /api/victims`**: Fetches all victim records from Supabase.
    *   **`POST /api/victims`**: Adds a new victim record to Supabase.
        *   Request Body: `{ name, age, address }`
    *   **`PUT /api/victims/:id`**: Updates a specific victim record.
        *   Request Body: `{ name, age, address }`
    *   **`DELETE /api/victims/:id`**: Deletes a specific victim record.
    *   **`GET /api/crime-locations`**: Fetches crimes with their location data (latitude, longitude).
    *   **`GET /api/areas`**: Fetches all area records from Supabase.
    *   **`POST /api/stations`**: Creates a new police station record.
        *   Request Body: `{ station_name, address, latitude, longitude }`
    *   **`GET /api/stations`**: Fetches all police station records.
    *   **`PUT /api/stations/:id`**: Updates a specific police station record.
        *   Request Body: `{ station_name, address, latitude, longitude }`
    *   **`DELETE /api/stations/:id`**: Deletes a specific police station record.

*   **MongoDB Community Reports Endpoints:**
    *   **`POST /api/community-reports`**: Creates a new community report in MongoDB.
        *   Request Body: `{ title, description, images (array), location, tags (array), user_id }`
    *   **`GET /api/community-reports`**: Fetches all community reports from MongoDB.
    *   **`DELETE /api/community-reports/:id`**: Deletes a specific community report.
    *   **`POST /api/community-reports/:id/comments`**: Adds a comment to a community report.
        *   Request Body: `{ user_id, comment }`
    *   **`GET /api/community-reports/:id/comments`**: Retrieves all comments for a report.
    *   **`POST /api/community-reports/:reportId/comments/:commentId/reply`**: Adds a reply to an existing comment.
        *   Request Body: `{ user_id, comment }`
    *   **`PUT /api/community-reports/:reportId/comments/:commentId/like`**: Likes a comment.
        *   Request Body: `{ user_id }`
    *   **`PUT /api/community-reports/:reportId/comments/:commentId/unlike`**: Unlikes a comment.
        *   Request Body: `{ user_id }`
    *   **`PUT /api/community-reports/:id/like`**: Likes a community report.
        *   Request Body: `{ user_id }`
    *   **`PUT /api/community-reports/:id/unlike`**: Unlikes a community report.
        *   Request Body: `{ user_id }`
    *   **`GET /api/community-reports/:id/comment-count`**: Gets the comment count for a community report.

### 3. Analytics Routes (`src/routes/analytics.js`)

Mounted under `/api/analytics`. Date parameters (`start`, `end` in `YYYY-MM-DD` format) default to the last 90 days if not provided.

*   **`GET /crimes-by-type`**: Fetches crime counts aggregated by crime type.
    *   Query Params: `start`, `end`
*   **`GET /crimes-by-area`**: Fetches crime counts aggregated by area.
    *   Query Params: `start`, `end`
*   **`GET /crimes-trend`**: Fetches crime trends over months, categorized into violent, property, and cyber crimes.
    *   Query Params: `start`, `end`
*   **`GET /crime-time-distribution`**: Fetches crime counts aggregated by the hour of the day.
*   **`GET /crimes-vs-arrests`**: Fetches a comparison of reported crimes vs. (mocked) arrests by crime type.
    *   Query Params: `start`, `end`
*   **`GET /victim-age-distribution`**: Fetches the distribution of victim ages involved in crimes.
*   **`GET /criminal-age-distribution`**: Fetches the distribution of criminal ages involved in crimes.
*   **`GET /crime-area-correlation`**: Fetches crime counts by area along with mock population data and calculated crime rates.

### 4. AI Routes (`src/routes/ai.js`)

Mounted under `/api/ai`.

*   **`POST /generate-content`**: Generates text content using Google Gemini based on a given prompt.
    *   Request Body: `{ prompt, systemInstruction (optional), model (optional) }`
*   **`GET /cached-predictions`**: Retrieves cached crime predictions. If not in cache, generates new ones and caches them.
    *   Query Params: `timeframe` (default '90' days), `areaLimit` (default '5')
    *   Response Headers: `X-From-Cache` (true/false)
*   **`POST /predict-crime-patterns`**: Generates or retrieves cached crime predictions.
    *   Request Body: `{ data: { timeframe, areaLimit }, updateCache (boolean, optional), forceFresh (boolean, optional) }`
    *   Response Headers: `X-From-Cache` (true/false)
*   **`POST /refresh-predictions`**: Forces a refresh of crime predictions and updates the cache.
    *   Request Body: `{ timeframe (optional), areaLimit (optional) }`

### 5. Safe Path Routes (`src/routes/safePath.js`)

Mounted under `/api`.

*   **`POST /calculate-safest-path`**: Calculates the safest path between two geographical points, considering crime data.
    *   Request Body: `{ from: { latitude, longitude }, to: { latitude, longitude }, timeframe (optional, default '90' days) }`
    *   Response: GeoJSON-like path or error message.

## Utils / Helper Modules

*   **`utils/analyticsDataFetcher.js`**:
    *   `fetchAllAnalyticsData(timeframe)`: Fetches and consolidates data from various analytics and raw data endpoints.
    *   `fetchCrimeLocationsForPathfinding(timeframe)`: Fetches crime location data specifically formatted for the pathfinding algorithm.
*   **`utils/geminiClient.js`**:
    *   `generateContent(prompt, systemInstruction, model)`: Sends prompts to the Google Gemini API to generate text-based content.
    *   `generateContentFromImage(prompt, imageData, options)`: (Not actively used by current routes but available) Sends prompts and images to Google Gemini Vision model.
*   **`utils/mongodbClient.js`**:
    *   `connectToMongoDB()`: Establishes a connection to the MongoDB server.
    *   Exports the MongoDB client instance.
*   **`utils/pathfindingAlgorithm.js`**:
    *   `calculateSafestPath(startPoint, endPoint, crimeData)`: Implements the logic to find the safest path using OpenRouteService API, considering provided crime data to avoid high-risk areas. It involves identifying high-crime zones, requesting routes that avoid these zones, and scoring routes based on crime proximity.
*   **`utils/redisClient.js`**:
    *   `getCache(key)`: Retrieves data from Redis cache.
    *   `setCache(key, value, expireSeconds)`: Stores data in Redis cache with an expiration time.
    *   Exports the Redis client instance.
*   **`utils/supabaseClient.js`**:
    *   Initializes and exports the Supabase client for interacting with the PostgreSQL database. Includes a connection check.

## Database Integration

*   **Supabase (PostgreSQL):**
    *   Used for storing core relational data such as:
        *   `crimes`: Information about reported crimes, including type, description, date.
        *   `criminals`: Profiles of criminals.
        *   `victims`: Profiles of victims.
        *   `crime_locations`: Geographic coordinates of crimes.
        *   `areas`: Definitions of geographical areas.
        *   `stations`: Information about police stations.
        *   Junction tables for many-to-many relationships (e.g., `crime_criminal`, `crime_victim`).
    *   Utilizes Supabase's RPC for transactional data insertion (e.g., `insert_crime_with_relations`).

*   **MongoDB:**
    *   Used for storing less structured, document-based data related to community engagement:
        *   `community_reports`: User-submitted reports including title, description, images, location, tags, user ID, and likes.
        *   `report_comments`: Comments on community reports, supporting threaded replies and likes.

## Core Functionalities - Data Flow & Interactions

### 1. Crime Data Management
*   **Flow:** Client (Frontend/Admin Panel) -> API Gateway -> `src/index.js` (Express Routes) -> `utils/supabaseClient.js` -> Supabase DB.
*   **Details:** Standard CRUD operations. The `POST /api/crimes` endpoint is notable for using a Supabase stored procedure (`insert_crime_with_relations`) to handle transactional inserts across multiple tables (crimes, crime_locations, and linking to existing criminals/victims).

### 2. Community Reporting
*   **Flow:** Client -> API Gateway -> `src/index.js` (Express Routes) -> `utils/mongodbClient.js` -> MongoDB.
*   **Details:** CRUD for reports and comments. Likes are handled by updating arrays within the report/comment documents in MongoDB.

### 3. Analytics Engine
*   **Flow:** Client -> API Gateway -> `src/routes/analytics.js` -> `utils/supabaseClient.js` -> Supabase DB.
*   **Details:** Endpoints in `analytics.js` query the Supabase database, aggregate data (e.g., counts by type, area, time distribution), and return structured JSON for frontend visualizations.

### 4. AI-Powered Crime Predictions
*   **Flow (Cache Miss/Refresh):**
    1.  Client -> API Gateway -> `src/routes/ai.js` (`/predict-crime-patterns` or `/refresh-predictions`).
    2.  `ai.js` calls `fetchAnalyticsData` (internally uses `utils/analyticsDataFetcher.js`).
    3.  `analyticsDataFetcher.js` makes HTTP requests to its own `/api/analytics/*` endpoints to gather data.
    4.  Aggregated data is passed to `generatePredictions` in `ai.js`.
    5.  `generatePredictions` constructs a prompt with the data and calls `utils/geminiClient.js`.
    6.  `geminiClient.js` sends the prompt to Google Gemini API.
    7.  Gemini API returns predictions.
    8.  `ai.js` parses the response, stores it in Redis via `utils/redisClient.js`, and returns it to the client.
*   **Flow (Cache Hit):**
    1.  Client -> API Gateway -> `src/routes/ai.js` (`/cached-predictions` or `/predict-crime-patterns`).
    2.  `ai.js` checks Redis via `utils/redisClient.js`.
    3.  If data exists, it's returned directly to the client.

### 5. Safest Path Calculation
*   **Flow:**
    1.  Client -> API Gateway -> `src/routes/safePath.js` (`/calculate-safest-path`).
    2.  `safePath.js` requests crime location data via `utils/analyticsDataFetcher.js -> fetchCrimeLocationsForPathfinding`.
    3.  `fetchCrimeLocationsForPathfinding` calls the `/api/crime-locations` endpoint.
    4.  Crime data and start/end coordinates are passed to `utils/pathfindingAlgorithm.js -> calculateSafestPath`.
    5.  `pathfindingAlgorithm.js`:
        *   Identifies high-crime areas from `crimeData`.
        *   Makes requests to OpenRouteService API (via Axios) to get routes, potentially with instructions to avoid identified polygons.
        *   Scores routes based on proximity to crime incidents.
        *   Selects the best route.
    6.  The calculated path is returned to the client.

### 6. Authentication
*   **Flow:**
    1.  Client navigates to `/auth/google`.
    2.  Server (`routes/auth.js`) redirects to Google's OAuth consent screen.
    3.  User authenticates with Google.
    4.  Google redirects back to `/auth/google/callback` with an authorization code.
    5.  Server (`routes/auth.js`) exchanges the code for tokens with Google and fetches user profile information.
    6.  User data and tokens are returned to the client (or a session/JWT is created and potentially redirected to the frontend).

## Diagramming Information

The details above should be sufficient to create various diagrams:

*   **Component Diagram:** Shows main modules (`src/index.js`, `routes/*`, `utils/*`) and external services (Supabase, MongoDB, Redis, Google Gemini, OpenRouteService).
*   **Data Flow Diagrams:** Illustrate how data moves through the system for key functionalities like AI prediction or safest path calculation.
*   **Sequence Diagrams:** Detail interactions between components for specific API calls. For example, a sequence diagram for `/api/ai/predict-crime-patterns` would show calls from the route handler to `analyticsDataFetcher`, then to `geminiClient`, and finally to `redisClient`.
*   **Deployment Diagram (Conceptual):** Would show the Node.js application server, connections to the different databases, caching layer, and external APIs.

## Potential Future Enhancements

*   Implement WebSocket for real-time updates (e.g., new community reports).
*   Add more sophisticated role-based access control (RBAC).
*   Expand AI capabilities (e.g., anomaly detection, resource allocation suggestions).
*   Integrate with mapping libraries on the frontend for richer visualization.
*   Implement job queues for long-running tasks (e.g., batch data processing or AI model training if applicable).
*   Add comprehensive unit and integration tests.
*   Full Swagger/OpenAPI documentation generation.