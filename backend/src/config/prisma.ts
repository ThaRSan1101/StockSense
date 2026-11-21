import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('FATAL CONFIG ERROR: DATABASE_URL environment variable is missing or empty.');
}

export const pool = new Pool({
  connectionString,
  max: 10, // Explicit pool limit: 10 connections for Node.js backend, preserving capacity for Python AI service on Neon
  idleTimeoutMillis: 30000, // Release idle clients after 30s
  connectionTimeoutMillis: 10000, // 10s timeout to connect to Neon
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
