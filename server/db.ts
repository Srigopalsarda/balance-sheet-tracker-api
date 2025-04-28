import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please check your environment variables.');
}

// Create the connection with SSL for production environments
const connectionOptions = process.env.NODE_ENV === 'production'
  ? {
      ssl: { rejectUnauthorized: false },
      max: 10 // Limit connection pool size for serverless environments
    }
  : {};

const client = postgres(process.env.DATABASE_URL, connectionOptions);
export const db = drizzle(client, { schema });

// Export a function to close the connection
export async function closeConnection() {
  await client.end();
}