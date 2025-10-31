#!/usr/bin/env tsx

/**
 * Script de diagnostic pour vérifier la configuration de l'environnement
 * Utilisez ce script pour identifier les problèmes de configuration entre ordinateurs
 */

// import { validateEnv } from '../lib/env-validation';

interface DiagnosticResult {
  variable: string;
  status: 'present' | 'missing' | 'invalid';
  value?: string;
  masked?: boolean;
}

function maskSensitiveValue(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}

function checkEnvironmentVariables(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  
  // Variables requises
  const requiredVars = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET', 
    'NEXT_PUBLIC_APP_URL',
    'AUTUMN_SECRET_KEY'
  ];
  
  // Variables optionnelles mais importantes
  const optionalVars = [
    'FIRECRAWL_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'PERPLEXITY_API_KEY',
    'RESEND_API_KEY',
    'STRIPE_SECRET_KEY',
    'GOOGLE_SEARCH_API_KEY',
    'GOOGLE_SEARCH_ENGINE_ID'
  ];
  
  // Vérifier les variables requises
  for (const varName of requiredVars) {
    const value = process.env[varName];
    results.push({
      variable: varName,
      status: value ? 'present' : 'missing',
      value: value ? maskSensitiveValue(value) : undefined,
      masked: true
    });
  }
  
  // Vérifier les variables optionnelles
  for (const varName of optionalVars) {
    const value = process.env[varName];
    results.push({
      variable: varName,
      status: value ? 'present' : 'missing',
      value: value ? maskSensitiveValue(value) : undefined,
      masked: true
    });
  }
  
  return results;
}

function checkProviderConfiguration(): { provider: string; configured: boolean; hasKey: boolean }[] {
  const providers = [
    { name: 'OpenAI', key: 'OPENAI_API_KEY' },
    { name: 'Anthropic', key: 'ANTHROPIC_API_KEY' },
    { name: 'Google', key: 'GOOGLE_GENERATIVE_AI_API_KEY' },
    { name: 'Perplexity', key: 'PERPLEXITY_API_KEY' },
    { name: 'Firecrawl', key: 'FIRECRAWL_API_KEY' }
  ];
  
  return providers.map(provider => ({
    provider: provider.name,
    configured: !!process.env[provider.key],
    hasKey: !!process.env[provider.key]
  }));
}

function checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000
      });
      
      await pool.query('SELECT 1');
      await pool.end();
      resolve({ connected: true });
    } catch (error) {
      resolve({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}

async function checkFirecrawlConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { connected: false, error: 'FIRECRAWL_API_KEY not configured' };
  }
  
  try {
    const firecrawlModule = await import('@mendable/firecrawl-js');
    const FirecrawlApp = (firecrawlModule as Record<string, unknown>).FirecrawlApp ?? (firecrawlModule as Record<string, unknown>).default;
    const firecrawl = new (FirecrawlApp as new (config: { apiKey: string }) => unknown)({ apiKey: process.env.FIRECRAWL_API_KEY });
    
    // Test simple avec une URL rapide
    const response = await (firecrawl as { scrapeUrl: (url: string, options: Record<string, unknown>) => Promise<unknown> }).scrapeUrl('https://httpbin.org/html', {
      formats: ['markdown'],
      timeout: 10000,
      onlyMainContent: true
    });
    
    return { connected: (response as { success: boolean }).success };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function main() {
  console.log('🔍 Diagnostic de configuration Voxum\n');
  
  // 1. Vérifier les variables d'environnement
  console.log('📋 Variables d\'environnement:');
  const envResults = checkEnvironmentVariables();
  
  const requiredMissing = envResults.filter(r => r.variable.includes('DATABASE_URL') || 
    r.variable.includes('BETTER_AUTH_SECRET') || 
    r.variable.includes('NEXT_PUBLIC_APP_URL') || 
    r.variable.includes('AUTUMN_SECRET_KEY')).filter(r => r.status === 'missing');
  
  if (requiredMissing.length > 0) {
    console.log('❌ Variables requises manquantes:');
    requiredMissing.forEach(r => console.log(`   - ${r.variable}`));
  } else {
    console.log('✅ Toutes les variables requises sont présentes');
  }
  
  const optionalPresent = envResults.filter(r => !r.variable.includes('DATABASE_URL') && 
    !r.variable.includes('BETTER_AUTH_SECRET') && 
    !r.variable.includes('NEXT_PUBLIC_APP_URL') && 
    !r.variable.includes('AUTUMN_SECRET_KEY')).filter(r => r.status === 'present');
  
  console.log(`📊 Variables optionnelles configurées: ${optionalPresent.length}/${envResults.length - 4}`);
  optionalPresent.forEach(r => console.log(`   ✅ ${r.variable}`));
  
  // 2. Vérifier la configuration des providers
  console.log('\n🤖 Configuration des providers:');
  const providerConfig = checkProviderConfiguration();
  providerConfig.forEach(p => {
    const status = p.configured ? '✅' : '❌';
    console.log(`   ${status} ${p.provider}: ${p.configured ? 'Configuré' : 'Non configuré'}`);
  });
  
  // 3. Tester la connexion à la base de données
  console.log('\n🗄️ Test de connexion à la base de données:');
  const dbResult = await checkDatabaseConnection();
  if (dbResult.connected) {
    console.log('✅ Connexion à la base de données réussie');
  } else {
    console.log(`❌ Échec de connexion à la base de données: ${dbResult.error}`);
  }
  
  // 4. Tester la connexion Firecrawl
  console.log('\n🕷️ Test de connexion Firecrawl:');
  const firecrawlResult = await checkFirecrawlConnection();
  if (firecrawlResult.connected) {
    console.log('✅ Connexion Firecrawl réussie');
  } else {
    console.log(`❌ Échec de connexion Firecrawl: ${firecrawlResult.error}`);
  }
  
  // 5. Recommandations
  console.log('\n💡 Recommandations:');
  
  if (requiredMissing.length > 0) {
    console.log('⚠️  Configurez les variables requises manquantes dans .env.local');
  }
  
  if (!providerConfig.find(p => p.provider === 'Firecrawl')?.configured) {
    console.log('⚠️  FIRECRAWL_API_KEY est essentiel pour le scraping - obtenez une clé sur https://app.firecrawl.dev/api-keys');
  }
  
  if (!providerConfig.find(p => p.provider === 'OpenAI')?.configured && 
      !providerConfig.find(p => p.provider === 'Anthropic')?.configured) {
    console.log('⚠️  Au moins un provider AI (OpenAI ou Anthropic) est nécessaire pour l\'extraction de données');
  }
  
  if (!dbResult.connected) {
    console.log('⚠️  Vérifiez votre DATABASE_URL et assurez-vous que la base de données est accessible');
  }
  
  console.log('\n✨ Diagnostic terminé');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as runDiagnostic };



