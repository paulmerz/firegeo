import { logger } from '@/lib/logger';

async function testApiDirect() {
  try {
    logger.info('🔍 Testing API directly...');

    // Test avec un ID d'analyse existant (vous devrez remplacer par un vrai ID)
    const analysisId = 'test-analysis-id'; // Remplacez par un vrai ID
    
    const baseUrl = 'http://localhost:3000';
    const url = `${baseUrl}/api/brand-monitor/analyses/${analysisId}/metrics-history?metricType=visibility_score`;
    
    logger.info(`📡 Testing URL: ${url}`);

    const response = await fetch(url);
    
    logger.info(`📊 Response status: ${response.status}`);
    logger.info(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ API Error: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    logger.info(`✅ API Response:`, JSON.stringify(data, null, 2));

  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testApiDirect().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});
