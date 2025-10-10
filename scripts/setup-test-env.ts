#!/usr/bin/env tsx

/**
 * Script pour configurer l'environnement de test avec les mocks AI
 * Usage: pnpm tsx scripts/setup-test-env.ts
 */

import fs from 'fs';
import path from 'path';

const envLocalPath = path.join(process.cwd(), '.env.local');

function setupTestEnvironment() {
  console.log('🔧 Configuration de l\'environnement de test...');
  
  // Vérifier si .env.local existe
  if (fs.existsSync(envLocalPath)) {
    console.log('📄 Fichier .env.local trouvé');
    
    // Lire le contenu existant
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    
    // Vérifier si MOCK_AI_FUNCTIONS est déjà défini
    if (content.includes('MOCK_AI_FUNCTIONS')) {
      console.log('✅ MOCK_AI_FUNCTIONS déjà configuré dans .env.local');
      
      // Vérifier la valeur
      const mockLine = content.split('\n').find(line => line.includes('MOCK_AI_FUNCTIONS'));
      if (mockLine?.includes('true')) {
        console.log('✅ MOCK_AI_FUNCTIONS=true est déjà configuré');
      } else {
        console.log('⚠️ MOCK_AI_FUNCTIONS trouvé mais pas à true');
        console.log('   Veuillez modifier manuellement dans .env.local :');
        console.log('   MOCK_AI_FUNCTIONS=true');
      }
    } else {
      // Ajouter MOCK_AI_FUNCTIONS
      const newContent = content + '\n# Configuration pour les tests E2E avec mocks AI\nMOCK_AI_FUNCTIONS=true\n';
      fs.writeFileSync(envLocalPath, newContent);
      console.log('✅ MOCK_AI_FUNCTIONS=true ajouté à .env.local');
    }
  } else {
    console.log('📄 Création du fichier .env.local');
    
    // Créer .env.local avec la configuration de test
    const content = `# Configuration pour les tests E2E avec mocks AI
MOCK_AI_FUNCTIONS=true

# Ajoutez vos autres variables d'environnement ici
# DATABASE_URL=...
# BETTER_AUTH_SECRET=...
# etc.
`;
    
    fs.writeFileSync(envLocalPath, content);
    console.log('✅ Fichier .env.local créé avec MOCK_AI_FUNCTIONS=true');
  }
  
  console.log('');
  console.log('🎯 Configuration terminée !');
  console.log('   Vous pouvez maintenant lancer les tests E2E :');
  console.log('   pnpm playwright test brand-monitor-mocked');
  console.log('');
}

// Exécuter le script
setupTestEnvironment();
