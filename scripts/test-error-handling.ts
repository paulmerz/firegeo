#!/usr/bin/env tsx

/**
 * Script de test pour vérifier la gestion des erreurs de détection de marque
 * Teste les différents scénarios d'erreur et le mécanisme de fallback
 */

import { detectBrandMentions, detectMultipleBrands } from '../lib/brand-detection-service';

async function testErrorHandling() {
  console.log('🧪 Test de la gestion des erreurs de détection de marque\n');

  // Test 1: Texte vide
  console.log('Test 1: Texte vide');
  try {
    await detectBrandMentions('', 'Nike');
    console.log('❌ Aucune erreur capturée pour texte vide');
  } catch (error) {
    console.log('✅ Erreur capturée:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Test 2: Nom de marque vide
  console.log('\nTest 2: Nom de marque vide');
  try {
    await detectBrandMentions('Nike est une marque de sport', '');
    console.log('❌ Aucune erreur capturée pour nom de marque vide');
  } catch (error) {
    console.log('✅ Erreur capturée:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Test 3: Détection multiple avec marques invalides
  console.log('\nTest 3: Détection multiple avec marques invalides');
  try {
    await detectMultipleBrands('Nike et Adidas sont des marques', ['Nike', '', 'Adidas']);
    console.log('❌ Aucune erreur capturée pour marques invalides');
  } catch (error) {
    console.log('✅ Erreur capturée:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n🎉 Tests de gestion des erreurs terminés');
  console.log('Note: Les tests de détection normale nécessitent une clé API OpenAI configurée');
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  testErrorHandling().catch(console.error);
}

export { testErrorHandling };
