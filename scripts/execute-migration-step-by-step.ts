#!/usr/bin/env tsx

/**
 * Script pour exécuter la migration étape par étape
 */

import { db } from '@/lib/db';

async function executeMigrationStepByStep() {
  console.log('🚀 Exécution de la migration étape par étape...');
  
  try {
    // 1. Vérifier l'état actuel
    console.log('📊 État actuel:');
    const currentState = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id
      FROM brand_analysis
    `);
    console.log(currentState.rows[0]);

    // 2. Vérifier si la colonne company_id existe déjà
    const columnCheck = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'brand_analysis' 
      AND column_name = 'company_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ La colonne company_id n\'existe pas encore');
      return;
    }
    
    console.log('✅ La colonne company_id existe');

    // 3. Vérifier les analyses sans company_id
    const analysesWithoutCompany = await db.execute(`
      SELECT id, url, company_name, industry
      FROM brand_analysis
      WHERE company_id IS NULL
    `);
    
    console.log(`📋 Analyses sans company_id: ${analysesWithoutCompany.rows.length}`);
    
    if (analysesWithoutCompany.rows.length === 0) {
      console.log('✅ Toutes les analyses ont déjà un company_id');
      return;
    }

    // 4. Afficher les analyses à migrer
    console.log('📋 Analyses à migrer:');
    analysesWithoutCompany.rows.forEach((analysis: any, index: number) => {
      console.log(`  ${index + 1}. ${analysis.company_name || 'N/A'} (${analysis.url})`);
    });

    // 5. Migrer chaque analyse
    for (const analysis of analysesWithoutCompany.rows) {
      console.log(`\n🔄 Migration de: ${analysis.company_name || 'N/A'} (${analysis.url})`);
      
      try {
        // Chercher une company existante
        const existingCompany = await db.execute(`
          SELECT id FROM companies 
          WHERE url = $1 OR name = $2
          LIMIT 1
        `, [analysis.url, analysis.company_name]);
        
        if (existingCompany.rows.length > 0) {
          // Company trouvée
          const companyId = existingCompany.rows[0].id;
          await db.execute(`
            UPDATE brand_analysis 
            SET company_id = $1
            WHERE id = $2
          `, [companyId, analysis.id]);
          console.log(`  ✅ Mappé vers company existante: ${companyId}`);
        } else {
          // Créer une nouvelle company
          const canonicalDomain = analysis.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          const companyName = analysis.company_name || canonicalDomain;
          
          const newCompany = await db.execute(`
            INSERT INTO companies (
              name, url, canonical_domain, primary_language, 
              business_type, enrichment_status
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [
            companyName,
            analysis.url,
            canonicalDomain,
            'en',
            analysis.industry,
            'stub'
          ]);
          
          const companyId = newCompany.rows[0].id;
          
          // Mettre à jour l'analyse
          await db.execute(`
            UPDATE brand_analysis 
            SET company_id = $1
            WHERE id = $2
          `, [companyId, analysis.id]);
          
          console.log(`  ✅ Créé nouvelle company: ${companyId}`);
        }
      } catch (error) {
        console.error(`  ❌ Erreur lors de la migration de ${analysis.id}:`, error);
      }
    }

    // 6. Vérifier le résultat final
    console.log('\n📊 Résultat final:');
    const finalState = await db.execute(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(company_id) as analyses_with_company_id,
        COUNT(*) - COUNT(company_id) as analyses_without_company_id
      FROM brand_analysis
    `);
    console.log(finalState.rows[0]);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

executeMigrationStepByStep();
