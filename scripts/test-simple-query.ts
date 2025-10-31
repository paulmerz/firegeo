// Script simple pour tester une requête SQL brute
import { createConnection } from 'pg';

async function testSimpleQuery() {
  const client = createConnection({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Test 1: Compter les événements métriques
    const countResult = await client.query('SELECT COUNT(*) FROM brand_analysis_metric_events');
    console.log(`📊 Total metric events: ${countResult.rows[0].count}`);

    if (countResult.rows[0].count > 0) {
      // Test 2: Récupérer quelques exemples
      const sampleResult = await client.query(`
        SELECT 
          bame.run_id,
          bame.competitor_name,
          bame.provider,
          bame.metric_type,
          bame.metric_value,
          bar.completed_at
        FROM brand_analysis_metric_events bame
        LEFT JOIN brand_analysis_runs bar ON bame.run_id = bar.id
        WHERE bar.status = 'completed'
        ORDER BY bar.completed_at DESC
        LIMIT 5
      `);
      
      console.log('📋 Sample data:', sampleResult.rows);

      // Test 3: Vérifier les analyses avec des runs
      const analysisResult = await client.query(`
        SELECT 
          ba.id as analysis_id,
          ba.company_name,
          COUNT(DISTINCT bar.id) as run_count
        FROM brand_analysis ba
        LEFT JOIN brand_analysis_runs bar ON ba.id = bar.brand_analysis_id
        WHERE bar.status = 'completed'
        GROUP BY ba.id, ba.company_name
        HAVING COUNT(DISTINCT bar.id) > 0
        ORDER BY run_count DESC
        LIMIT 3
      `);
      
      console.log('🎯 Analyses with runs:', analysisResult.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testSimpleQuery();
