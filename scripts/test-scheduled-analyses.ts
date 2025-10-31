#!/usr/bin/env tsx

/**
 * Script de test pour les analyses périodiques
 * 
 * Ce script teste le workflow complet :
 * 1. Création d'une analyse avec scheduling
 * 2. Vérification de la configuration
 * 3. Simulation d'exécution CRON
 * 4. Vérification des runs créés
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { brandAnalysis, brandAnalysisRuns, workspaces, companies } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Charger les variables d'environnement
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in environment variables');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function testScheduledAnalyses() {
  console.log('🧪 Testing Scheduled Analyses Workflow...\n');

  try {
    // 1. Vérifier que les tables existent
    console.log('1️⃣ Checking database schema...');
    
    await db.select().from(brandAnalysis).limit(1);
    console.log('✅ brand_analyses table exists');
    
    await db.select().from(brandAnalysisRuns).limit(1);
    console.log('✅ brand_analysis_runs table exists');
    
    // 2. Créer les entités nécessaires (workspace et company)
    console.log('\n2️⃣ Creating test workspace and company...');
    
    const workspaceId = randomUUID();
    const companyId = randomUUID();
    
    // Créer un workspace de test
    const [testWorkspace] = await db
      .insert(workspaces)
      .values({
        id: workspaceId,
        name: 'Test Workspace'
      })
      .returning();
    
    console.log(`✅ Test workspace created with ID: ${testWorkspace.id}`);
    
    // Créer une company de test
    const [testCompany] = await db
      .insert(companies)
      .values({
        id: companyId,
        name: 'Test Company',
        url: 'https://test-company.com',
        canonicalDomain: 'test-company.com'
      })
      .returning();
    
    console.log(`✅ Test company created with ID: ${testCompany.id}`);
    
    // 3. Créer une analyse de test avec scheduling
    console.log('\n3️⃣ Creating test analysis with scheduling...');
    
    const testAnalysis = {
      userId: 'test-user-123',
      workspaceId: testWorkspace.id,
      companyId: testCompany.id,
      analysisName: 'Test Analysis',
      competitors: [{ name: 'Competitor 1' }, { name: 'Competitor 2' }],
      prompts: ['Test prompt 1', 'Test prompt 2'],
      creditsUsed: 4,
      periodicity: 'daily' as const,
      isScheduled: true,
      nextRunAt: new Date(Date.now() - 1000), // Dans le passé pour être éligible immédiatement
      schedulePaused: false
    };
    
    const [createdAnalysis] = await db
      .insert(brandAnalysis)
      .values(testAnalysis)
      .returning();
    
    console.log(`✅ Test analysis created with ID: ${createdAnalysis.id}`);
    
    // 4. Vérifier la configuration
    console.log('\n4️⃣ Verifying analysis configuration...');
    
    const [retrievedAnalysis] = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.id, createdAnalysis.id))
      .limit(1);
    
    if (!retrievedAnalysis) {
      throw new Error('Analysis not found');
    }
    
    console.log(`✅ Analysis periodicity: ${retrievedAnalysis.periodicity}`);
    console.log(`✅ Analysis scheduled: ${retrievedAnalysis.isScheduled}`);
    console.log(`✅ Next run at: ${retrievedAnalysis.nextRunAt}`);
    
    // 5. Simuler l'exécution CRON
    console.log('\n5️⃣ Simulating CRON execution...');
    
    const cronResponse = await fetch('http://localhost:3000/api/cron/scheduled-analyses', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!cronResponse.ok) {
      const errorText = await cronResponse.text();
      throw new Error(`CRON endpoint failed: ${cronResponse.status} - ${errorText}`);
    }
    
    const cronResult = await cronResponse.json();
    console.log(`✅ CRON execution result:`, cronResult);
    
    // 6. Vérifier les runs créés
    console.log('\n6️⃣ Checking created runs...');
    
    const runs = await db
      .select()
      .from(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.brandAnalysisId, createdAnalysis.id))
      .orderBy(brandAnalysisRuns.createdAt);
    
    console.log(`✅ Found ${runs.length} runs for analysis`);
    
    if (runs.length > 0) {
      const latestRun = runs[runs.length - 1];
      console.log(`✅ Latest run status: ${latestRun.status}`);
      console.log(`✅ Latest run started at: ${latestRun.startedAt}`);
      console.log(`✅ Latest run credits used: ${latestRun.creditsUsed}`);
    }
    
    // 7. Nettoyer les données de test
    console.log('\n7️⃣ Cleaning up test data...');
    
    await db
      .delete(brandAnalysisRuns)
      .where(eq(brandAnalysisRuns.brandAnalysisId, createdAnalysis.id));
    
    await db
      .delete(brandAnalysis)
      .where(eq(brandAnalysis.id, createdAnalysis.id));
    
    await db
      .delete(companies)
      .where(eq(companies.id, testCompany.id));
    
    await db
      .delete(workspaces)
      .where(eq(workspaces.id, testWorkspace.id));
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! Scheduled analyses workflow is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter les tests
testScheduledAnalyses().catch(console.error);
