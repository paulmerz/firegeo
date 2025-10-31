#!/usr/bin/env tsx

/**
 * Script personnalisé pour exécuter les migrations manuelles
 * 
 * Ce script exécute nos migrations manuelles idempotentes
 * au lieu d'utiliser drizzle-kit migrate
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

// Charger les variables d'environnement
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(DATABASE_URL);

async function runMigrations() {
  console.log('🚀 Running manual migrations...\n');

  try {
    // Trouver tous les fichiers de migration dans le dossier migrations
    const migrationFiles = await glob('migrations/*.sql');
    
    // Trier par nom de fichier (qui contient le numéro de migration)
    migrationFiles.sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files:`);
    migrationFiles.forEach(file => console.log(`  - ${file}`));
    console.log();
    
    for (const file of migrationFiles) {
      console.log(`🔄 Running migration: ${file}`);
      
      const migrationPath = join(process.cwd(), file);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      try {
        // Diviser le SQL en statements individuels (non utilisé mais gardé pour référence)
        // const statements = migrationSQL
        //   .split(';')
        //   .map(s => s.trim())
        //   .filter(s => s.length > 0 && !s.startsWith('--'));
        
        // Exécuter le SQL complet en une fois pour supporter les blocs DO $$
        await client.unsafe(migrationSQL);
        
        console.log(`  ✅ Migration completed successfully`);
      } catch (error: unknown) {
        console.error(`  ❌ Migration failed:`, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
    
    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter les migrations
runMigrations().catch(console.error);
