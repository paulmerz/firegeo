#!/usr/bin/env tsx

/**
 * Script de test pour vérifier que les migrations sont idempotentes
 * 
 * Ce script applique les migrations plusieurs fois pour s'assurer
 * qu'elles ne génèrent pas d'erreurs lors d'exécutions répétées.
 */

import { config } from 'dotenv';
// import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Charger les variables d'environnement
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
// const db = drizzle(client);

async function testMigrationsIdempotent() {
  console.log('🧪 Testing Migrations Idempotency...\n');

  try {
    // Lire les fichiers de migration
    const migrations = [
      '004_add_companies_competitors_aliases.sql',
      '008_add_scheduling_to_brand_analyses.sql',
      '009_create_brand_analysis_runs.sql',
      '010_adapt_brand_analysis_sources.sql'
    ];

    for (const migrationFile of migrations) {
      console.log(`📁 Testing migration: ${migrationFile}`);
      
      const migrationPath = join(process.cwd(), 'migrations', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      // Exécuter la migration plusieurs fois
      for (let i = 1; i <= 3; i++) {
        console.log(`  🔄 Execution ${i}/3...`);
        
        try {
          // Diviser le SQL en statements individuels
          const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
          
          for (const statement of statements) {
            if (statement.trim()) {
              await client.unsafe(statement);
            }
          }
          
          console.log(`    ✅ Execution ${i} successful`);
        } catch (error: unknown) {
          console.error(`    ❌ Execution ${i} failed:`, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }
      }
      
      console.log(`  ✅ Migration ${migrationFile} is idempotent\n`);
    }
    
    console.log('🎉 All migrations are idempotent!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter les tests
testMigrationsIdempotent().catch(console.error);
