# SEO & GEO Configuration Guide

Ce guide explique comment Voxum est optimisé pour le SEO traditionnel et le GEO (Generative Engine Optimization).

## 📋 Fichiers créés

### 1. **llms.txt** (`public/llms.txt`)
Fichier optimisé pour les LLMs (Large Language Models) qui aide les IA à mieux comprendre votre site.
- Accessible à : `https://voxum.maj.digital/llms.txt`
- Contient : description, fonctionnalités, tarifs, cas d'usage
- Référence : https://llmstxt.org/

### 2. **robots.ts** (`app/robots.ts`)
Gestion dynamique du fichier robots.txt avec règles spécifiques pour les bots IA.
- **Bloque l'indexation sur les environnements de staging/développement**
- Permet l'accès aux bots IA uniquement en production : GPTBot, Claude-Web, PerplexityBot, Google-Extended
- Bloque les routes privées : `/api/`, `/dashboard/`
- Génère automatiquement : `https://voxum.maj.digital/robots.txt`

### 3. **sitemap.ts** (`app/sitemap.ts`)
Génération dynamique du sitemap XML multilingue.
- URLs en/fr pour toutes les pages publiques
- Inclut `llms.txt` pour le GEO
- Génère automatiquement : `https://voxum.maj.digital/sitemap.xml`

## 🔧 Configuration

### Variables d'environnement

Dans `.env.local` :

```bash
# URL de production - Seul ce domaine sera indexé
NEXT_PUBLIC_APP_URL=https://voxum.maj.digital
```

**Important** : 
- En production : `NEXT_PUBLIC_APP_URL=https://voxum.maj.digital`
- En staging : Utiliser l'URL du sous-domaine (ex: `https://staging.voxum.maj.digital`)
- Le système bloquera automatiquement l'indexation si l'URL n'est pas `voxum.maj.digital`

## 🛡️ Protection contre l'indexation en staging

Le système bloque automatiquement l'indexation sur tous les environnements **sauf** `voxum.maj.digital`.

### Comment ça fonctionne

1. **robots.txt** : Si `NEXT_PUBLIC_APP_URL ≠ https://voxum.maj.digital`
   ```
   User-agent: *
   Disallow: /
   ```

2. **Meta tags** : En staging, ajout automatique de :
   ```html
   <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
   ```

3. **Alternates** : Les balises `canonical` et `hreflang` ne sont générées qu'en production

## 📊 Vérification

### 1. Vérifier robots.txt
```bash
curl https://voxum.maj.digital/robots.txt
```

### 2. Vérifier sitemap.xml
```bash
curl https://voxum.maj.digital/sitemap.xml
```

### 3. Vérifier llms.txt
```bash
curl https://voxum.maj.digital/llms.txt
```

### 4. Vérifier l'environnement
```bash
# En staging, robots.txt devrait bloquer tout
curl https://staging.voxum.maj.digital/robots.txt
# Résultat attendu : User-agent: * / Disallow: /

# En production, robots.txt devrait autoriser
curl https://voxum.maj.digital/robots.txt
# Résultat attendu : règles complètes avec bots IA
```

## 🎯 Bots IA autorisés (production uniquement)

Les bots suivants ont un accès optimisé sur `voxum.maj.digital` :

- **GPTBot** (OpenAI) - crawlDelay: 2s
- **ChatGPT-User** (OpenAI conversational)
- **Claude-Web** (Anthropic)
- **PerplexityBot** (Perplexity AI)
- **Google-Extended** (Google Bard/Gemini)

**Note** : En staging, tous les bots sont bloqués automatiquement.

## 📝 Métadonnées SEO

Les métadonnées sont déjà configurées dans :
- `app/layout.tsx` - Métadonnées globales avec `metadataBase`
- `app/[locale]/layout.tsx` - Métadonnées localisées (titre, description, OG, Twitter)

### Robots meta tag
```typescript
robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-video-preview': -1,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
}
```

## 🔍 Optimisation GEO

### Bonnes pratiques

1. **Mettez à jour llms.txt** régulièrement avec :
   - Nouvelles fonctionnalités
   - Cas d'usage mis à jour
   - Tarifs actuels
   - Mots-clés pertinents

2. **Vérifiez les environnements** :
   - Production : `NEXT_PUBLIC_APP_URL=https://voxum.maj.digital`
   - Staging : URL différente pour bloquer automatiquement l'indexation
   - Testez `robots.txt` après chaque déploiement

3. **Monitorer les sources** :
   - Utilisez l'onglet "Sources" dans Brand Monitor
   - Vérifiez quelles URLs sont citées par les IA
   - Optimisez le contenu des pages les plus citées

## 📚 Ressources

- [llms.txt Standard](https://llmstxt.org/)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google Search Central](https://developers.google.com/search)
- [Robots.txt Specification](https://developers.google.com/search/docs/crawling-indexing/robots/intro)

## ⚠️ Notes importantes

1. **Protection automatique** : Seul `voxum.maj.digital` est indexé
2. **llms.txt** est complémentaire au robots.txt pour le GEO
3. Les bots IA respectent les règles du **robots.txt**
4. Vérifiez `NEXT_PUBLIC_APP_URL` dans chaque environnement
5. Testez `robots.txt` après déploiement

## 🆘 Support

Pour toute question sur la configuration SEO/GEO :
- Email : info@maj.digital
- Documentation : https://voxum.maj.digital/en/docs

