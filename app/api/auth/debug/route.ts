import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  // Check if we can connect to the database
  let dbStatus = 'unknown';
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
    });
    
    await pool.query('SELECT 1');
    dbStatus = 'connected';
    await pool.end();
  } catch (error) {
    dbStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return NextResponse.json({
    envCheck,
    dbStatus,
    timestamp: new Date().toISOString(),
  });
}