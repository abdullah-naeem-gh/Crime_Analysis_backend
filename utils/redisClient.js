import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Use env vars to avoid hardcoding credentials
const redis = new Redis(process.env.REDIS_URL, {
  retryStrategy: (times) => {
    // Retry with exponential backoff
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

// Handle connection events
redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} Parsed data or null if not found
 */
const getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Redis getCache error for key ${key}:`, error);
    return null;
  }
};

/**
 * Set value in cache with expiration
 * @param {string} key - Cache key
 * @param {any} value - Data to store (will be JSON stringified)
 * @param {number} expireSeconds - Seconds until expiration
 * @returns {Promise<boolean>} Success status
 */
const setCache = async (key, value, expireSeconds = 86400) => {
  try {
    await redis.setex(key, expireSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis setCache error for key ${key}:`, error);
    return false;
  }
};

// Export the redis client and utility functions
export default redis;
export { getCache, setCache };
