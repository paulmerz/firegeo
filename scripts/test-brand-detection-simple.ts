#!/usr/bin/env tsx

/**
 * Test Simple pour Brand Detection
 * Version simplifiée pour tester rapidement des cas spécifiques
 */

// Charger les variables d'environnement
import dotenv from 'dotenv';
import path from 'path';

// Charger .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { detectBrandMentions } from '../lib/brand-detection-service';

// Cas de test spécifiques pour les pièges mentionnés
const testCases = [
  {
    name: "Radical - Marque vs Adjectif",
    text: "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque",
    brand: "Radical",
    expected: 1
  },
  {
    name: "Louis Vuitton - Variations",
    text: "LVMH a publié ses résultats et Louis Vuitton tire le wagon. LV a encore performé cette année et louis vuitton restera longtemps sur le podium",
    brand: "Louis Vuitton", 
    expected: 3
  },
  {
    name: "Orange - Casse",
    text: "Orange est une marque française, mais j'aime les oranges du marché. Orange a encore de beaux jours devant elle.",
    brand: "Orange",
    expected: 2
  }
];

async function runQuickTest() {
  console.log('🚀 Test Rapide de Détection de Marques\n');
  
  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log(`📄 Texte: "${testCase.text}"`);
    console.log(`🎯 Marque: "${testCase.brand}"`);
    console.log(`📊 Attendu: ${testCase.expected} détection(s)`);
    
    try {
      const result = await detectBrandMentions(testCase.text, testCase.brand);
      const actual = result.matches.length;
      const passed = actual === testCase.expected;
      
      console.log(`✅ Résultat: ${actual} détection(s) trouvée(s)`);
      console.log(`🎯 Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (result.matches.length > 0) {
        console.log(`🔍 Détections:`);
        result.matches.forEach((match, i) => {
          console.log(`   ${i + 1}. "${match.text}" (${match.variation}, conf: ${match.confidence.toFixed(2)})`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    console.log('-'.repeat(60));
  }
}

// Test d'une marque spécifique
async function testSpecificBrand(brand: string, text: string) {
  console.log(`\n🔍 Test spécifique pour "${brand}"`);
  console.log(`📄 Texte: "${text}"`);
  
  try {
    const result = await detectBrandMentions(text, brand);
    console.log(`✅ Résultat: ${result.matches.length} détection(s)`);
    
    if (result.matches.length > 0) {
      console.log(`🔍 Détections:`);
      result.matches.forEach((match, i) => {
        console.log(`   ${i + 1}. "${match.text}" (${match.variation}, conf: ${match.confidence.toFixed(2)})`);
      });
    } else {
      console.log(`ℹ️  Aucune détection trouvée`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

// Exécution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 2) {
    // Test d'une marque spécifique
    testSpecificBrand(args[0], args[1]);
  } else {
    // Test rapide
    runQuickTest();
  }
}

export { runQuickTest, testSpecificBrand };
