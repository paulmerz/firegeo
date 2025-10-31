# Déduplication des Companies - Résumé

## ��� Problème résolu

**Avant :**
- `rolex.fr` et `rolex.com` créaient 2 entrées distinctes dans `companies`
- Aucune réutilisation des données en cache
- Scraping systématique même si données déjà présentes

**Après :**
- Une seule entrée `Rolex` dans `companies`
- Multiples URLs stockées dans `company_urls` 
- Données servies depuis cache BDD si disponibles
- Pas de scraping inutile

## ��� Changements implémentés

### 1. Fichier `lib/db/companies-deduplication.ts` (nouveau)

**Fonctions utilitaires :**
- `extractBrandNameFromDomain()` : rolex.fr → "Rolex"
- `normalizeCompanyName()` : "Rolex Inc." → "rolex"
- `isSameDomainBase()` : compare rolex.fr et rolex.com → true
- `calculateSimilarity()` : score de similarité entre noms

### 2. Fichier `lib/db/companies-service.ts` (modifié)

**Fonction `getOrCreateCompanyByUrl()` améliorée :**

```typescript
// 1. Cherche par domaine canonique exact
// 2. Cherche dans company_urls (URLs alternatives)
// 3. NOUVEAU: Cherche par nom de marque similaire
//    Ex: Si "Rolex" existe, rolex.fr matchera
// 4. Si match trouvé:
//    - Ajoute l'URL dans company_urls
//    - Met à jour canonical_domain si .com (plus générique)
// 5. Sinon: crée une nouvelle company avec nom extrait
```

**Fonction `upsertCompanyFromScrape()` améliorée :**

```typescript
// 1. Appelle getOrCreateCompanyByUrl() pour déduplication
// 2. NOUVEAU: Vérifie si locale existe déjà
// 3. Si locale existe ET enrichment_status !== 'stub':
//    → Retourne l'ID sans réécrire (cache hit!)
// 4. Sinon: sauvegarde normalement
```

**Nouvelle fonction `getCompanyFromCache()` :**

```typescript
// Récupère company + locale depuis BDD
// Retourne null si:
// - Company n'existe pas
// - C'est un stub
// - Locale n'existe pas
// Sinon: retourne Company complète prête à l'emploi
```

### 3. Fichier `app/api/brand-monitor/scrape/route.ts` (modifié)

**Avant scraping :**
```typescript
// 1. Appelle getCompanyFromCache(url, locale)
// 2. Si cache hit:
//    → Sert les données, duration=0, pas de scraping
// 3. Si cache miss:
//    → Scrape normalement
//    → Sauvegarde via upsertCompanyFromScrape()
```

## ��� Résultat

### Table `companies`
```
id   | name   | url           | canonical_domain
-----|--------|---------------|------------------
uuid | Rolex  | rolex.com     | rolex.com
```

### Table `company_urls`
```
id   | company_id | url
-----|------------|------------
uuid | {rolex-id} | rolex.com
uuid | {rolex-id} | rolex.fr
```

### Table `company_locales`
```
id   | company_id | locale | title           | description
-----|------------|--------|-----------------|-------------
uuid | {rolex-id} | en     | Rolex Watches   | ...
uuid | {rolex-id} | fr     | Montres Rolex   | ...
```

## ��� Comportement

### Scénario 1: Nouvelle marque (cache miss)
```
1. User: scrape("apple.com", locale="en")
   → Cache miss (company n'existe pas)
   → Scraping réel
   → Sauvegarde: company "Apple" + locale "en"
   → Retour: données fraîches
```

### Scénario 2: Même URL, locale différente (cache miss partiel)
```
2. User: scrape("apple.com", locale="fr")
   → Company "Apple" existe
   → Locale "fr" n'existe pas
   → Scraping réel pour locale FR
   → Sauvegarde: locale "fr" pour company existante
   → Retour: données fraîches FR
```

### Scénario 3: URL différente, même marque (déduplication)
```
3. User: scrape("apple.fr", locale="fr")
   → Détection: "Apple" existe déjà (via isSameDomainBase)
   → Ajout de "apple.fr" dans company_urls
   → Locale "fr" existe déjà !
   → CACHE HIT: pas de scraping
   → Retour: données depuis BDD (instantané)
```

### Scénario 4: Re-scrape même URL+locale (cache hit)
```
4. User: scrape("apple.com", locale="en")
   → Company "Apple" existe
   → Locale "en" existe
   → CACHE HIT: pas de scraping
   → Retour: données depuis BDD (instantané)
```

## ✅ Bénéfices

1. **Pas de doublons** : Une marque = Une company
2. **Performance** : Cache BDD évite scraping inutile
3. **Multi-domaines** : .com, .fr, .co.uk → même company
4. **Multi-locales** : Chaque locale scrapée une seule fois
5. **Traçabilité** : Toutes URLs alternatives dans `company_urls`

## ��� Prochaines étapes optionnelles

1. **Politique de refresh** : Ajouter TTL (ex: 30 jours)
2. **Merge manuel** : API pour fusionner doublons existants
3. **Recherche fuzzy** : Index trigram sur `companies.name`
4. **Stats** : Taux de cache hit/miss

## ��� Test rapide

```bash
# Dans Drizzle Studio (pnpm db:studio)
# Avant test: Supprimer Rolex si existe

# Test 1: Scrape rolex.com (en)
# Résultat attendu: 1 company "Rolex", 1 URL, 1 locale

# Test 2: Scrape rolex.com (en) à nouveau
# Résultat attendu: Cache hit, pas de nouveau scraping

# Test 3: Scrape rolex.fr (fr)
# Résultat attendu: Même company, +1 URL, +1 locale

# Test 4: Scrape rolex.fr (fr) à nouveau
# Résultat attendu: Cache hit, pas de scraping
```
