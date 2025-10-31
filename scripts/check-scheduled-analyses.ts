#!/usr/bin/env tsx

/**
 * Script pour vérifier les analyses programmées dans la base de données
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { brandAnalysis } from '../lib/db/schema';
import { and, eq, lte } from 'drizzle-orm';

// Charger les variables d'environnement
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function checkAnalyses() {
  console.log('🔍 Checking scheduled analyses in database...\n');

  try {
    // Vérifier toutes les analyses programmées
    const allScheduled = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.isScheduled, true));
    
    console.log(`📊 Total scheduled analyses: ${allScheduled.length}\n`);
    
    if (allScheduled.length > 0) {
      allScheduled.forEach((analysis, index) => {
        console.log(`${index + 1}. Analysis ID: ${analysis.id}`);
        console.log(`   - Scheduled: ${analysis.isScheduled}`);
        console.log(`   - Paused: ${analysis.schedulePaused}`);
        console.log(`   - Next run: ${analysis.nextRunAt}`);
        console.log(`   - Periodicity: ${analysis.periodicity}`);
        console.log(`   - User ID: ${analysis.userId}`);
        console.log('---');
      });
    }
    
    // Vérifier les analyses éligibles (comme dans l'API CRON)
    const eligibleAnalyses = await db
      .select()
      .from(brandAnalysis)
      .where(
        and(
          eq(brandAnalysis.isScheduled, true),
          eq(brandAnalysis.schedulePaused, false),
          lte(brandAnalysis.nextRunAt, new Date())
        )
      );
    
    console.log(`\n✅ Eligible analyses (ready to run): ${eligibleAnalyses.length}`);
    
    if (eligibleAnalyses.length > 0) {
      eligibleAnalyses.forEach((analysis, index) => {
        console.log(`${index + 1}. Analysis ID: ${analysis.id}`);
        console.log(`   - Next run: ${analysis.nextRunAt}`);
        console.log(`   - Periodicity: ${analysis.periodicity}`);
      });
    } else {
      console.log('\n❌ No analyses are currently eligible for execution.');
      console.log('   This could be because:');
      console.log('   - No analyses are scheduled');
      console.log('   - All analyses are paused');
      console.log('   - All analyses are scheduled for future execution');
    }
    
  } catch (error) {
    console.error('❌ Error checking analyses:', error);
  } finally {
    await client.end();
  }
}

// Exécuter la vérification
checkAnalyses().catch(console.error);




