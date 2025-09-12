# Guide de Dépannage - FireGEO

## Problème : Divergence entre ordinateurs

Si vous obtenez des réponses sur un ordinateur mais pas sur l'autre, voici les causes les plus probables et leurs solutions :

### 1. Variables d'environnement manquantes

**Symptôme :** Aucune donnée n'est extraite, erreurs dans la console

**Solution :**
```bash
# Exécuter le diagnostic
npm run debug:env
```

**Variables critiques à vérifier :**
- `FIRECRAWL_API_KEY` - **ESSENTIEL** pour le scraping
- `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` - **ESSENTIEL** pour l'extraction de données
- `AUTUMN_SECRET_KEY` - **ESSENTIEL** pour la vérification des crédits

### 2. Configuration des providers AI

**Symptôme :** Erreur "No AI providers configured"

**Solution :**
1. Vérifiez que au moins une clé API AI est configurée
2. Redémarrez le serveur après avoir ajouté les variables
3. Vérifiez que les clés sont valides

### 3. Problèmes de réseau

**Symptôme :** Timeouts, erreurs de connexion

**Solutions :**
- Vérifiez votre connexion internet
- Vérifiez les paramètres de firewall/proxy
- Essayez avec une URL différente (plus simple)

### 4. Problèmes de base de données

**Symptôme :** Erreurs d'authentification, problèmes de crédits

**Solution :**
```bash
# Vérifier la connexion à la base de données
npm run db:push
```

### 5. Problèmes de cache

**Symptôme :** Données obsolètes ou incohérentes

**Solution :**
```bash
# Nettoyer le cache et redémarrer
rm -rf .next
npm run dev
```

## Diagnostic Automatique

### Exécuter le diagnostic complet

```bash
npm run debug:env
```

Ce script vérifie :
- ✅ Variables d'environnement requises
- ✅ Configuration des providers AI
- ✅ Connexion à la base de données
- ✅ Connexion à Firecrawl
- ✅ Configuration des clés API

### Logs de debug

Les logs détaillés sont maintenant activés. Regardez la console pour :
- `🔍 [Scraper]` - Logs de scraping
- `🔍 [Processor]` - Logs d'extraction de données
- `🔍 [Scrape API]` - Logs de l'API
- `❌` - Erreurs détaillées

## Solutions par Type d'Erreur

### Erreur : "FIRECRAWL_API_KEY not configured"
```bash
# Ajouter dans .env.local
FIRECRAWL_API_KEY=your_key_here
```

### Erreur : "No AI providers configured"
```bash
# Ajouter au moins une clé API dans .env.local
OPENAI_API_KEY=your_key_here
# OU
ANTHROPIC_API_KEY=your_key_here
```

### Erreur : "Insufficient credits"
- Vérifiez votre compte Autumn
- Assurez-vous que les produits sont correctement configurés
- Vérifiez que `AUTUMN_SECRET_KEY` est correct

### Erreur : "Connection timeout"
- Vérifiez votre connexion internet
- Essayez avec une URL plus simple
- Vérifiez les paramètres de proxy/firewall

## Vérification Rapide

1. **Variables d'environnement :**
   ```bash
   npm run debug:env
   ```

2. **Redémarrer le serveur :**
   ```bash
   npm run dev
   ```

3. **Tester avec une URL simple :**
   - Essayez `https://example.com` d'abord
   - Puis testez avec votre URL cible

4. **Vérifier les logs :**
   - Ouvrez la console du navigateur
   - Regardez les logs du serveur
   - Identifiez le point de défaillance

## Support

Si le problème persiste :
1. Exécutez `npm run debug:env` et partagez le résultat
2. Partagez les logs de la console
3. Indiquez l'URL que vous essayez de scraper
4. Précisez les différences entre les deux ordinateurs

