#!/usr/bin/env tsx

/**
 * Script pour vérifier la structure de la base de données
 */

import { config } from 'dotenv';
import postgres from 'postgres';

// Charger les variables d'environnement
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(DATABASE_URL);

async function checkDbStructure() {
  console.log('🔍 Checking database structure...\n');

  try {
    // Vérifier la structure de brand_aliases
    console.log('📋 brand_aliases table structure:');
    const brandAliasesStructure = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'brand_aliases' 
      ORDER BY ordinal_position;
    `;
    
    console.table(brandAliasesStructure);
    
    // Vérifier les contraintes de brand_aliases
    console.log('\n🔗 brand_aliases constraints:');
    const brandAliasesConstraints = await client`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'brand_aliases'::regclass;
    `;
    
    console.table(brandAliasesConstraints);
    
    // Vérifier si brand_alias_sets existe
    console.log('\n📋 brand_alias_sets table exists:');
    const brandAliasSetsExists = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'brand_alias_sets'
      ) as exists;
    `;
    
    console.log(brandAliasSetsExists[0]);
    
  } catch (error) {
    console.error('❌ Error checking database structure:', error);
  } finally {
    await client.end();
  }
}

// Exécuter le script
checkDbStructure().catch(console.error);
