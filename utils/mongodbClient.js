import { MongoClient, ServerApiVersion } from 'mongodb';
import { config } from 'dotenv';

config();

const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export default client;