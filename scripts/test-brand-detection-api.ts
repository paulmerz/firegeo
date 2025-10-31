#!/usr/bin/env tsx

/**
 * Test API pour Brand Detection
 * Teste le endpoint /api/brand-detection via HTTP
 */

interface TestCase {
  name: string;
  text: string;
  brandName: string;
  expectedCount: number;
  description: string;
}

interface TestResult {
  testCase: TestCase;
  passed: boolean;
  actualCount: number;
  matches: Array<{ text: string; confidence: number; variation: string }>;
  error?: string;
}

const testCases: TestCase[] = [
  {
    name: "Radical - Marque vs Adjectif",
    text: "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque",
    brandName: "Radical",
    expectedCount: 1,
    description: "Radical est une marque mais aussi un adjectif. Seule la marque doit être détectée."
  },
  {
    name: "Louis Vuitton - Variations Multiples",
    text: "LVMH a publié ses résultats et Louis Vuitton tire le wagon. LV a encore performé cette année et louis vuitton restera longtemps sur le podium",
    brandName: "Louis Vuitton",
    expectedCount: 3,
    description: "Louis Vuitton doit être détecté sous ses différentes formes mais pas LVMH (groupe)"
  },
  {
    name: "Orange - Sensibilité Casse",
    text: "Orange est une marque française, mais j'aime les oranges du marché. Orange a encore de beaux jours devant elle.",
    brandName: "Orange",
    expectedCount: 2,
    description: "Orange avec majuscule = marque, orange minuscule = fruit"
  },
  {
    name: "Apple - Marque vs Fruit",
    text: "Apple a sorti un nouvel iPhone. J'ai mangé une pomme (apple en anglais) ce matin. Apple Inc. continue d'innover.",
    brandName: "Apple",
    expectedCount: 2,
    description: "Apple = marque, apple = fruit"
  },
  {
    name: "BMW - Acronyme Distinctif",
    text: "BMW a présenté ses nouveaux modèles. bmw est une marque allemande. BMW Group continue d'innover.",
    brandName: "BMW",
    expectedCount: 3,
    description: "BMW doit être détecté sous toutes ses formes"
  },
  {
    name: "Mercedes - Marque Distinctive",
    text: "Mercedes-Benz a lancé un nouveau modèle. Mercedes est une marque de luxe. mercedes-benz continue d'innover.",
    brandName: "Mercedes",
    expectedCount: 3,
    description: "Mercedes doit être détecté même dans Mercedes-Benz"
  },
  {
    name: "Nike - Marque vs Déesse",
    text: "Nike a sorti de nouvelles chaussures. Dans la mythologie, Nike est la déesse de la victoire. nike continue d'innover.",
    brandName: "Nike",
    expectedCount: 3,
    description: "Nike marque et déesse doivent être détectés"
  },
  {
    name: "Tesla - Marque vs Scientifique",
    text: "Tesla Motors a révolutionné l'auto électrique. L'unité tesla mesure l'induction magnétique. Tesla continue d'innover.",
    brandName: "Tesla",
    expectedCount: 3,
    description: "Tesla marque et unité scientifique doivent être détectés"
  },
  {
    name: "Black - Marque vs Couleur",
    text: "Black & Decker a sorti un nouvel outil. J'ai acheté une voiture noire (black en anglais). Black est une marque d'outils.",
    brandName: "Black",
    expectedCount: 2,
    description: "Black dans Black & Decker et seul, mais pas comme couleur"
  },
  {
    name: "Microsoft - Marque vs Mot Générique",
    text: "Microsoft a sorti Windows 11. Les micro-ordinateurs sont partout. Microsoft Corporation continue d'innover.",
    brandName: "Microsoft",
    expectedCount: 2,
    description: "Microsoft marque mais pas micro-ordinateurs"
  },
  {
    name: "Google - Marque vs Verbe",
    text: "Google a lancé un nouveau service. Je vais googler cette information. Google Inc. continue d'innover.",
    brandName: "Google",
    expectedCount: 2,
    description: "Google marque mais pas googler (verbe)"
  },
  {
    name: "Amazon - Marque vs Fleuve",
    text: "Amazon a livré ma commande. L'Amazone est un fleuve d'Amérique du Sud. amazon.com est le site de vente.",
    brandName: "Amazon",
    expectedCount: 2,
    description: "Amazon marque et site web mais pas le fleuve Amazone"
  }
];

class BrandDetectionAPITester {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async runTest(testCase: TestCase): Promise<TestResult> {
    try {
      console.log(`\n🧪 Test: ${testCase.name}`);
      console.log(`📝 Description: ${testCase.description}`);
      console.log(`📄 Texte: "${testCase.text}"`);
      console.log(`🎯 Marque: "${testCase.brandName}"`);
      console.log(`📊 Attendu: ${testCase.expectedCount} détection(s)`);

      const response = await fetch(`${this.baseUrl}/api/brand-detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testCase.text,
          brandNames: testCase.brandName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      const actualCount = result.matches ? result.matches.length : 0;
      const passed = actualCount === testCase.expectedCount;

      const testResult: TestResult = {
        testCase,
        passed,
        actualCount,
        matches: result.matches ? result.matches.map((m: Record<string, unknown>) => ({
          text: m.text,
          confidence: m.confidence,
          variation: m.variation
        })) : []
      };

      console.log(`✅ Résultat: ${actualCount} détection(s) trouvée(s)`);
      console.log(`🎯 Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (result.matches && result.matches.length > 0) {
        console.log(`🔍 Détections:`);
        result.matches.forEach((match: Record<string, unknown>, index: number) => {
          console.log(`   ${index + 1}. "${match.text}" (variation: ${match.variation}, confiance: ${typeof match.confidence === 'number' ? match.confidence.toFixed(2) : 'N/A'})`);
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
    console.log('🚀 Démarrage des tests API de détection de marques...\n');
    console.log(`📊 ${testCases.length} tests à exécuter\n`);

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      this.results.push(result);
      
      // Petite pause entre les tests pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DES TESTS API');
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

  // Test d'une marque spécifique via API
  async testSpecificBrand(brandName: string, text: string): Promise<void> {
    console.log(`\n🔍 Test API spécifique pour "${brandName}"`);
    console.log(`📄 Texte: "${text}"`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/brand-detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          brandNames: brandName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log(`✅ Résultat: ${result.matches ? result.matches.length : 0} détection(s)`);
      
      if (result.matches && result.matches.length > 0) {
        console.log(`🔍 Détections:`);
        result.matches.forEach((match: Record<string, unknown>, i: number) => {
          console.log(`   ${i + 1}. "${match.text}" (${match.variation}, conf: ${typeof match.confidence === 'number' ? match.confidence.toFixed(2) : 'N/A'})`);
        });
      } else {
        console.log(`ℹ️  Aucune détection trouvée`);
      }
      
    } catch (error) {
      console.log(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }
}

// Exécution
if (require.main === module) {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  
  const tester = new BrandDetectionAPITester(baseUrl);
  
  if (args.length >= 3) {
    // Test d'une marque spécifique
    tester.testSpecificBrand(args[1], args[2]);
  } else {
    // Test complet
    tester.runAllTests().catch(error => {
      console.error('❌ Erreur lors de l\'exécution des tests:', error);
      process.exit(1);
    });
  }
}

export { BrandDetectionAPITester, testCases };
