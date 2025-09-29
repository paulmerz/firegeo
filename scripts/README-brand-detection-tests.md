# Tests de Détection de Marques

Ce dossier contient les tests pour le service de détection de marques, conçus pour vérifier que le système détecte correctement les marques dans différents contextes et évite les faux positifs.

## Scripts Disponibles

### 1. Test Complet (Direct)
```bash
pnpm test:brand-detection
```
Exécute tous les tests de détection de marques en utilisant directement le service.

### 2. Test Simple (Direct)
```bash
pnpm test:brand-detection-simple
```
Exécute un test rapide avec 3 cas de test principaux.

### 3. Test API (HTTP)
```bash
pnpm test:brand-detection-api
```
Exécute tous les tests via l'API HTTP (nécessite que le serveur soit démarré).

## Tests de Marque Spécifique

### Test Direct
```bash
tsx scripts/test-brand-detection-simple.ts "Radical" "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque"
```

### Test API
```bash
tsx scripts/test-brand-detection-api.ts http://localhost:3000 "Radical" "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque"
```

## Cas de Test Inclus

### 1. Radical - Marque vs Adjectif
- **Texte**: "La marque Radical a encore de beaux jours devant elle, même s'il s'agit d'un virage radical pour la marque"
- **Attendu**: 1 détection (seulement la marque, pas l'adjectif)
- **Piège**: Distinguer la marque "Radical" de l'adjectif "radical"

### 2. Louis Vuitton - Variations Multiples
- **Texte**: "LVMH a publié ses résultats et Louis Vuitton tire le wagon. LV a encore performé cette année et louis vuitton restera longtemps sur le podium"
- **Attendu**: 3 détections (Louis Vuitton, LV, louis vuitton)
- **Piège**: Détecter les variations mais pas LVMH (groupe)

### 3. Orange - Sensibilité à la Casse
- **Texte**: "Orange est une marque française, mais j'aime les oranges du marché. Orange a encore de beaux jours devant elle."
- **Attendu**: 2 détections (Orange avec majuscule seulement)
- **Piège**: Distinguer la marque "Orange" du fruit "oranges"

### 4. Apple - Marque vs Fruit
- **Texte**: "Apple a sorti un nouvel iPhone. J'ai mangé une pomme (apple en anglais) ce matin. Apple Inc. continue d'innover."
- **Attendu**: 2 détections (Apple et Apple Inc.)
- **Piège**: Distinguer la marque "Apple" du fruit "apple"

### 5. BMW - Acronyme Distinctif
- **Texte**: "BMW a présenté ses nouveaux modèles. bmw est une marque allemande. BMW Group continue d'innover."
- **Attendu**: 3 détections (BMW, bmw, BMW Group)
- **Piège**: Détecter l'acronyme sous toutes ses formes

### 6. Mercedes - Marque Distinctive
- **Texte**: "Mercedes-Benz a lancé un nouveau modèle. Mercedes est une marque de luxe. mercedes-benz continue d'innover."
- **Attendu**: 3 détections (Mercedes-Benz, Mercedes, mercedes-benz)
- **Piège**: Détecter "Mercedes" même dans "Mercedes-Benz"

### 7. Nike - Marque vs Déesse
- **Texte**: "Nike a sorti de nouvelles chaussures. Dans la mythologie, Nike est la déesse de la victoire. nike continue d'innover."
- **Attendu**: 3 détections (Nike marque, Nike déesse, nike)
- **Piège**: Détecter la marque et la référence mythologique

### 8. Tesla - Marque vs Scientifique
- **Texte**: "Tesla Motors a révolutionné l'auto électrique. L'unité tesla mesure l'induction magnétique. Tesla continue d'innover."
- **Attendu**: 3 détections (Tesla Motors, tesla unité, Tesla)
- **Piège**: Détecter la marque et l'unité scientifique

### 9. Black - Marque vs Couleur
- **Texte**: "Black & Decker a sorti un nouvel outil. J'ai acheté une voiture noire (black en anglais). Black est une marque d'outils."
- **Attendu**: 2 détections (Black & Decker, Black)
- **Piège**: Distinguer la marque de la couleur

### 10. Microsoft - Marque vs Mot Générique
- **Texte**: "Microsoft a sorti Windows 11. Les micro-ordinateurs sont partout. Microsoft Corporation continue d'innover."
- **Attendu**: 2 détections (Microsoft, Microsoft Corporation)
- **Piège**: Distinguer la marque du mot générique "micro-ordinateurs"

### 11. Google - Marque vs Verbe
- **Texte**: "Google a lancé un nouveau service. Je vais googler cette information. Google Inc. continue d'innover."
- **Attendu**: 2 détections (Google, Google Inc.)
- **Piège**: Distinguer la marque du verbe "googler"

### 12. Amazon - Marque vs Fleuve
- **Texte**: "Amazon a livré ma commande. L'Amazone est un fleuve d'Amérique du Sud. amazon.com est le site de vente."
- **Attendu**: 2 détections (Amazon, amazon.com)
- **Piège**: Distinguer la marque du fleuve "Amazone"

## Interprétation des Résultats

### ✅ PASSED
Le test a réussi - le nombre de détections correspond exactement au nombre attendu.

### ❌ FAILED
Le test a échoué - le nombre de détections ne correspond pas au nombre attendu.

### Erreurs Communes
- **Faux positifs**: Détection de mots communs comme marques
- **Faux négatifs**: Non-détection de variations de marques
- **Problèmes de casse**: Mauvaise gestion de la sensibilité à la casse
- **Problèmes de contexte**: Détection dans de mauvais contextes

## Configuration Requise

- Clé API OpenAI configurée dans `.env.local`
- Serveur de développement démarré (pour les tests API)
- Node.js avec tsx installé

## Dépannage

### Erreur de Clé API
```
Error: OpenAI API key not configured
```
Vérifiez que `OPENAI_API_KEY` est configurée dans `.env.local`.

### Erreur de Connexion API
```
Error: fetch failed
```
Vérifiez que le serveur de développement est démarré avec `pnpm dev`.

### Erreur de Parsing JSON
```
Error: Invalid response format
```
Le service AI a retourné une réponse mal formatée. Vérifiez les logs pour plus de détails.
