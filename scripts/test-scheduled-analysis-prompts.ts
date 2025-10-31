import * as dotenv from 'dotenv';
import { db } from '../lib/db';
import { brandAnalysis } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function testScheduledAnalysisPrompts() {
  try {
    console.log('🔍 Testing scheduled analysis prompts retrieval...');

    // Récupérer une analyse avec des prompts
    const [analysis] = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.isScheduled, true))
      .orderBy(desc(brandAnalysis.createdAt))
      .limit(1);

    if (!analysis) {
      console.log('❌ No scheduled analysis found');
      return;
    }

    console.log('📊 Analysis found:', {
      id: analysis.id,
      url: analysis.url,
      companyName: analysis.companyName,
      periodicity: analysis.periodicity,
      isScheduled: analysis.isScheduled,
      prompts: analysis.prompts,
      promptsType: typeof analysis.prompts,
      promptsLength: Array.isArray(analysis.prompts) ? analysis.prompts.length : 'Not an array'
    });

    if (Array.isArray(analysis.prompts) && analysis.prompts.length > 0) {
      console.log('✅ Prompts found:', analysis.prompts);
    } else {
      console.log('❌ No prompts found or prompts is not an array');
    }

    // Tester la récupération pour le CRON
    const [cronAnalysis] = await db
      .select()
      .from(brandAnalysis)
      .where(eq(brandAnalysis.isScheduled, true))
      .orderBy(desc(brandAnalysis.createdAt))
      .limit(1);

    if (cronAnalysis?.prompts && Array.isArray(cronAnalysis.prompts)) {
      console.log('✅ CRON can retrieve prompts:', cronAnalysis.prompts);
    } else {
      console.log('❌ CRON cannot retrieve prompts');
    }

  } catch (error) {
    console.error('❌ Error testing scheduled analysis prompts:', error);
  } finally {
    process.exit(0);
  }
}

testScheduledAnalysisPrompts();
