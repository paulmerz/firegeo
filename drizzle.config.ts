import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default {
  schema: './lib/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Exclude Better Auth tables from migrations since they're managed by Better Auth
  tablesFilter: ['!user', '!session', '!account', '!verification'],
  // Generate idempotent migrations
  migrations: {
    prefix: 'timestamp',
  },
} satisfies Config;