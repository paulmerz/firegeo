#!/usr/bin/env tsx

/**
 * Script de test pour vérifier que les noms des concurrents sont correctement stockés
 * avec le nom de l'API au lieu de l'extraction du domaine
 */

import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema/companies';
import { eq } from 'drizzle-orm';

async function testCompetitorNameStorage() {
  console.log('🧪 [Test] Vérification du stockage des noms de concurrents...');
  
  try {
    // Chercher des companies récentes qui pourraient être des concurrents
    const recentCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.enrichmentStatus, 'stub'))
      .limit(10);
    
    console.log(`📊 [Test] Trouvé ${recentCompanies.length} companies récentes (stub):`);
    
    recentCompanies.forEach((company, index) => {
      console.log(`${index + 1}. Nom: "${company.name}"`);
      console.log(`   URL: ${company.url}`);
      console.log(`   Canonical Domain: ${company.canonicalDomain}`);
      console.log(`   Enrichment Status: ${company.enrichmentStatus}`);
      console.log(`   Créé: ${company.createdAt}`);
      console.log('---');
    });
    
    // Vérifier s'il y a des noms qui semblent être extraits de domaines
    const suspiciousNames = recentCompanies.filter(company => {
      const name = company.name.toLowerCase();
      const domain = company.canonicalDomain.toLowerCase();
      
      // Vérifier si le nom ressemble à un domaine (pas d'espaces, tirets, etc.)
      return name === domain || 
             name.replace(/\s+/g, '-') === domain ||
             name.replace(/\s+/g, '') === domain.replace(/-/g, '');
    });
    
    if (suspiciousNames.length > 0) {
      console.log('⚠️ [Test] Noms suspects (probablement extraits de domaines):');
      suspiciousNames.forEach((company, index) => {
        console.log(`${index + 1}. "${company.name}" (domaine: ${company.canonicalDomain})`);
      });
    } else {
      console.log('✅ [Test] Aucun nom suspect trouvé - les noms semblent corrects');
    }
    
    // Chercher des companies avec des noms qui contiennent des espaces (bon signe)
    const companiesWithSpaces = recentCompanies.filter(company => 
      company.name.includes(' ')
    );
    
    console.log(`\n📈 [Test] Companies avec espaces dans le nom (bon signe): ${companiesWithSpaces.length}`);
    companiesWithSpaces.forEach((company, index) => {
      console.log(`${index + 1}. "${company.name}"`);
    });
    
  } catch (error) {
    console.error('❌ [Test] Erreur lors du test:', error);
  }
}

// Exécuter le test
testCompetitorNameStorage()
  .then(() => {
    console.log('\n✅ [Test] Test terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ [Test] Erreur fatale:', error);
    process.exit(1);
  });
