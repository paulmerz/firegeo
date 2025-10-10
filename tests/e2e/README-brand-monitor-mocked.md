# Test E2E Brand Monitor avec Mocks AI

## Description

Ce test E2E simule le flux complet de l'analyse de marque en utilisant des mocks pour les réponses AI. Il teste :

1. **Connexion utilisateur** - Inscription et authentification
2. **Scraping d'entreprise** - Récupération des données Rolex mockées
3. **Identification des concurrents** - Détection des concurrents horlogers
4. **Génération de prompts** - Création de 4 prompts d'analyse
5. **Analyse AI** - Traitement par batch de 3 prompts avec mocks
6. **Affichage des résultats** - Vérification des highlights et statistiques

## Configuration requise

### 1. Variables d'environnement

Le test utilise le système de mock AI déjà implémenté dans le codebase. Pour l'activer :

```bash
# Option 1: Utiliser le script de configuration
pnpm tsx scripts/setup-test-env.ts

# Option 2: Ajouter manuellement dans .env.local
echo "MOCK_AI_FUNCTIONS=true" >> .env.local
```

### 2. Fixtures mockées

Le test utilise les fixtures suivantes :
- `tests/fixtures/brand-monitor/company.json` - Données Rolex
- `tests/fixtures/brand-monitor/competitors.json` - Concurrents horlogers
- `tests/fixtures/brand-monitor/ai-responses.json` - 8 réponses AI mockées

## Exécution

```bash
# Lancer le test spécifique
pnpm playwright test brand-monitor-mocked

# Lancer en mode debug (avec interface graphique)
pnpm playwright test brand-monitor-mocked --headed

# Lancer avec logs détaillés
pnpm playwright test brand-monitor-mocked --reporter=list
```

## Fonctionnement

### 1. Mocks AI

Le test n'intercepte **PAS** l'endpoint `/api/brand-monitor/analyze`. Au lieu de cela :

- Les fonctions `analyzePromptWithProvider` et `analyzePromptWithProviderEnhanced` détectent `MOCK_AI_FUNCTIONS=true`
- Elles utilisent les mocks de `lib/ai-utils-mock.ts`
- Le backend traite les prompts par batch de 3 comme en production
- Le streaming SSE fonctionne normalement

### 2. Interceptions API

Le test intercepte uniquement les endpoints nécessaires :
- `/api/brand-monitor/scrape` - Données Rolex mockées
- `/api/credits` - Éviter les débits réels
- `/api/brand-monitor/check-providers` - Liste des providers
- `/api/competitors/ai-search` - Concurrents mockés
- `/api/generate-prompts` - 4 prompts mockés

### 3. Validations

Le test vérifie :
- ✅ Affichage de la CompanyCard Rolex
- ✅ Identification des 4 concurrents
- ✅ Génération des 4 prompts
- ✅ Lancement de l'analyse
- ✅ Apparition des onglets d'analyse
- ✅ **8+ highlights de marque "Rolex"** (basé sur les fixtures)

## Avantages de cette approche

1. **Réaliste** - Utilise le vrai flux SSE et le traitement par batch
2. **Rapide** - Les mocks AI sont instantanés
3. **Déterministe** - Résultats prévisibles basés sur les fixtures
4. **Maintenable** - Pas de simulation SSE complexe
5. **Robuste** - Teste la vraie logique métier

## Dépannage

### Le test échoue sur les highlights

Vérifiez que :
- `MOCK_AI_FUNCTIONS=true` est dans `.env.local`
- Le serveur de dev est redémarré après modification de `.env.local`
- Les fixtures AI contiennent bien des mentions de "Rolex"

### Le test est trop lent

Les mocks AI devraient être instantanés. Si c'est lent, vérifiez que :
- Les mocks sont bien activés (logs `[MOCK]` dans la console)
- Aucune vraie API AI n'est appelée

### Erreurs de timeout

Augmentez le timeout dans le test si nécessaire :
```typescript
await expect(page.getByRole('tab', { name: /Prompts et réponses/i }))
  .toBeVisible({ timeout: 120000 }); // 2 minutes
```
