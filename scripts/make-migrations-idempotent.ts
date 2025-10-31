#!/usr/bin/env tsx

/**
 * Script pour rendre les migrations Drizzle idempotentes
 * 
 * Ce script modifie les fichiers de migration générés par Drizzle
 * pour les rendre idempotentes en ajoutant des vérifications IF NOT EXISTS
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
// import { join } from 'path';

async function makeMigrationsIdempotent() {
  console.log('🔧 Making Drizzle migrations idempotent...\n');

  try {
    // Trouver tous les fichiers de migration dans le dossier drizzle-generated
    const migrationFiles = await glob('drizzle-generated/*.sql');
    
    for (const file of migrationFiles) {
      console.log(`📁 Processing: ${file}`);
      
      let content = readFileSync(file, 'utf8');
      let modified = false;
      
      // Remplacer CREATE TYPE par CREATE TYPE IF NOT EXISTS
      const createTypeRegex = /CREATE TYPE "([^"]+)" AS ENUM\(([^)]+)\);/g;
      content = content.replace(createTypeRegex, (match, typeName, enumValues) => {
        modified = true;
        return `DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
        CREATE TYPE "${typeName}" AS ENUM(${enumValues});
    END IF;
END $$;`;
      });
      
      // Remplacer CREATE TABLE par CREATE TABLE IF NOT EXISTS
      const createTableRegex = /CREATE TABLE "([^"]+)" \(/g;
      content = content.replace(createTableRegex, (match, tableName) => {
        modified = true;
        return `CREATE TABLE IF NOT EXISTS "${tableName}" (`;
      });
      
      // Remplacer CREATE INDEX par CREATE INDEX IF NOT EXISTS
      const createIndexRegex = /CREATE (UNIQUE )?INDEX "([^"]+)" ON/g;
      content = content.replace(createIndexRegex, (match, unique, indexName) => {
        modified = true;
        return `CREATE ${unique || ''}INDEX IF NOT EXISTS "${indexName}" ON`;
      });
      
      // Remplacer ALTER TABLE ADD COLUMN par des blocs DO $$
      const addColumnRegex = /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g;
      content = content.replace(addColumnRegex, (match, tableName, columnName, columnDef) => {
        modified = true;
        return `DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '${tableName}' AND column_name = '${columnName}'
    ) THEN
        ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDef};
    END IF;
END $$;`;
      });
      
      // Remplacer ALTER TABLE ADD CONSTRAINT par des blocs DO $$
      const addConstraintRegex = /ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" ([^;]+);/g;
      content = content.replace(addConstraintRegex, (match, tableName, constraintName, constraintDef) => {
        modified = true;
        return `DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = '${constraintName}'
    ) THEN
        ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" ${constraintDef};
    END IF;
END $$;`;
      });
      
      if (modified) {
        writeFileSync(file, content);
        console.log(`  ✅ Made idempotent`);
      } else {
        console.log(`  ⏭️  No changes needed`);
      }
    }
    
    console.log('\n🎉 All migrations are now idempotent!');
    
  } catch (error) {
    console.error('❌ Error making migrations idempotent:', error);
    process.exit(1);
  }
}

// Exécuter le script
makeMigrationsIdempotent().catch(console.error);
