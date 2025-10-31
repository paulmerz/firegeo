#!/usr/bin/env tsx

/**
 * Test Suite for Brand Detection Service
 * Tests various edge cases and tricky scenarios for brand detection
 */

// Charger les variables d'environnement
import dotenv from 'dotenv';
import path from 'path';

// Charger .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { detectBrandMentions } from '../lib/brand-detection-service';

interface TestCase {
  name: string;
  text: string;
  brandName: string;
  expectedCount: number;
  description: string;
  shouldFail?: boolean; // If true, expects 0 matches
}

interface TestResult {
  testCase: TestCase;
  passed: boolean;
  actualCount: number;
  matches: Array<{ text: string; confidence: number; variation: string }>;
  error?: string;
}

const testCases: TestCase[] = [
  // Test 1: Radical - marque vs adjectif
  {
    name: "Radical - Marque vs Adjectif",
    text: "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque",
    brandName: "Radical",
    expectedCount: 1, // Seulement la marque, pas l'adjectif
    description: "Radical est une marque mais aussi un adjectif. Seule la marque doit être détectée."
  },

  // Test 2: Louis Vuitton - variations multiples
  {
    name: "Louis Vuitton - Variations Multiples",
    text: "LVMH a publié ses résultats et Louis Vuitton tire le wagon. LV a encore performé cette année et louis vuitton restera longtemps sur le podium",
    brandName: "Louis Vuitton",
    expectedCount: 3, // Louis Vuitton, LV, louis vuitton
    description: "Louis Vuitton doit être détecté sous ses différentes formes mais pas LVMH (groupe)"
  },

  // Test 3: Orange - sensibilité à la casse
  {
    name: "Orange - Sensibilité Casse",
    text: "Orange est une marque française, mais j'aime les oranges du marché. Orange a encore de beaux jours devant elle.",
    brandName: "Orange",
    expectedCount: 2, // Seulement les majuscules
    description: "Orange avec majuscule = marque, orange minuscule = fruit"
  },

  // Test 4: Apple - marque vs fruit
  {
    name: "Apple - Marque vs Fruit",
    text: "Apple a sorti un nouvel iPhone. J'ai mangé une pomme (apple en anglais) ce matin. Apple Inc. continue d'innover.",
    brandName: "Apple",
    expectedCount: 2, // Apple et Apple Inc.
    description: "Apple = marque, apple = fruit"
  },

  // Test 5: BMW - acronyme distinctif
  {
    name: "BMW - Acronyme Distinctif",
    text: "BMW a présenté ses nouveaux modèles. bmw est une marque allemande. BMW Group continue d'innover.",
    brandName: "BMW",
    expectedCount: 3, // BMW, bmw, BMW Group
    description: "BMW doit être détecté sous toutes ses formes"
  },

  // Test 6: Mercedes - marque distinctive
  {
    name: "Mercedes - Marque Distinctive",
    text: "Mercedes-Benz a lancé un nouveau modèle. Mercedes est une marque de luxe. mercedes-benz continue d'innover.",
    brandName: "Mercedes",
    expectedCount: 3, // Mercedes-Benz, Mercedes, mercedes-benz
    description: "Mercedes doit être détecté même dans Mercedes-Benz"
  },

  // Test 7: Nike - marque vs déesse
  {
    name: "Nike - Marque vs Déesse",
    text: "Nike a sorti de nouvelles chaussures. Dans la mythologie, Nike est la déesse de la victoire. nike continue d'innover.",
    brandName: "Nike",
    expectedCount: 3, // Nike, Nike (déesse), nike
    description: "Nike marque et déesse doivent être détectés"
  },

  // Test 8: Tesla - marque vs scientifique
  {
    name: "Tesla - Marque vs Scientifique",
    text: "Tesla Motors a révolutionné l'auto électrique. L'unité tesla mesure l'induction magnétique. Tesla continue d'innover.",
    brandName: "Tesla",
    expectedCount: 3, // Tesla Motors, tesla (unité), Tesla
    description: "Tesla marque et unité scientifique doivent être détectés"
  },

  // Test 9: Black - marque vs couleur
  {
    name: "Black - Marque vs Couleur",
    text: "Black & Decker a sorti un nouvel outil. J'ai acheté une voiture noire (black en anglais). Black est une marque d'outils.",
    brandName: "Black",
    expectedCount: 2, // Black & Decker, Black
    description: "Black dans Black & Decker et seul, mais pas comme couleur"
  },

  // Test 10: Microsoft - marque vs mot générique
  {
    name: "Microsoft - Marque vs Mot Générique",
    text: "Microsoft a sorti Windows 11. Les micro-ordinateurs sont partout. Microsoft Corporation continue d'innover.",
    brandName: "Microsoft",
    expectedCount: 2, // Microsoft, Microsoft Corporation
    description: "Microsoft marque mais pas micro-ordinateurs"
  },

  // Test 11: Google - marque vs verbe
  {
    name: "Google - Marque vs Verbe",
    text: "Google a lancé un nouveau service. Je vais googler cette information. Google Inc. continue d'innover.",
    brandName: "Google",
    expectedCount: 2, // Google, Google Inc.
    description: "Google marque mais pas googler (verbe)"
  },

  // Test 12: Amazon - marque vs fleuve
  {
    name: "Amazon - Marque vs Fleuve",
    text: "Amazon a livré ma commande. L'Amazone est un fleuve d'Amérique du Sud. amazon.com est le site de vente.",
    brandName: "Amazon",
    expectedCount: 2, // Amazon, amazon.com
    description: "Amazon marque et site web mais pas le fleuve Amazone"
  }
];

class BrandDetectionTester {
  private results: TestResult[] = [];

  async runTest(testCase: TestCase): Promise<TestResult> {
    try {
      console.log(`\n🧪 Test: ${testCase.name}`);
      console.log(`📝 Description: ${testCase.description}`);
      console.log(`📄 Texte: "${testCase.text}"`);
      console.log(`🎯 Marque: "${testCase.brandName}"`);
      console.log(`📊 Attendu: ${testCase.expectedCount} détection(s)`);

      const result = await detectBrandMentions(testCase.text, testCase.brandName, {
        caseSensitive: false,
        excludeNegativeContext: false,
        minConfidence: 0.3
      });

      const actualCount = result.matches.length;
      const passed = actualCount === testCase.expectedCount;

      const testResult: TestResult = {
        testCase,
        passed,
        actualCount,
        matches: result.matches.map(m => ({
          text: m.text,
          confidence: m.confidence,
          variation: m.variation
        }))
      };

      console.log(`✅ Résultat: ${actualCount} détection(s) trouvée(s)`);
      console.log(`🎯 Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (result.matches.length > 0) {
        console.log(`🔍 Détections:`);
        result.matches.forEach((match, index) => {
          console.log(`   ${index + 1}. "${match.text}" (variation: ${match.variation}, confiance: ${match.confidence.toFixed(2)})`);
        });
      }

      return testResult;
    } catch (error) {
      console.log(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      
      return {
        testCase,
        passed: false,
        actualCount: 0,
        matches: [],
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Démarrage des tests de détection de marques...\n');
    console.log(`📊 ${testCases.length} tests à exécuter\n`);

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      this.results.push(result);
      
      // Petite pause entre les tests pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`\n📈 Statistiques:`);
    console.log(`   ✅ Réussis: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`   ❌ Échoués: ${failed}/${total} (${((failed/total)*100).toFixed(1)}%)`);

    if (failed > 0) {
      console.log(`\n❌ Tests échoués:`);
      this.results
        .filter(r => !r.passed)
        .forEach((result, index) => {
          console.log(`\n   ${index + 1}. ${result.testCase.name}`);
          console.log(`      Attendu: ${result.testCase.expectedCount} détection(s)`);
          console.log(`      Obtenu: ${result.actualCount} détection(s)`);
          if (result.error) {
            console.log(`      Erreur: ${result.error}`);
          }
          if (result.matches.length > 0) {
            console.log(`      Détections trouvées:`);
            result.matches.forEach(match => {
              console.log(`        - "${match.text}" (${match.variation}, conf: ${match.confidence.toFixed(2)})`);
            });
          }
        });
    }

    console.log(`\n🎯 Résultat global: ${failed === 0 ? '✅ TOUS LES TESTS RÉUSSIS' : '❌ CERTAINS TESTS ONT ÉCHOUÉ'}`);
    console.log('='.repeat(80));

    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
  }
}

// Fonction utilitaire pour tester une marque spécifique
export async function testSingleBrand(brandName: string, text: string): Promise<void> {
  console.log(`\n🔍 Test rapide pour "${brandName}"`);
  console.log(`📄 Texte: "${text}"`);
  
  try {
    const result = await detectBrandMentions(text, brandName);
    console.log(`✅ Résultat: ${result.matches.length} détection(s)`);
    result.matches.forEach((match, index) => {
      console.log(`   ${index + 1}. "${match.text}" (${match.variation}, confiance: ${match.confidence.toFixed(2)})`);
    });
  } catch (error) {
    console.log(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

// Exécution des tests si le script est appelé directement
if (require.main === module) {
  const tester = new BrandDetectionTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Erreur lors de l\'exécution des tests:', error);
    process.exit(1);
  });
}

export { BrandDetectionTester, testCases };
