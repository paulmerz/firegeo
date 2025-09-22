# OpenAI Web Search Implementation

## Vue d'ensemble

Cette implémentation ajoute le support de la recherche web OpenAI utilisant l'API Responses avec l'outil `web_search`. Lorsque le toggle `useWebSearch` est activé, OpenAI effectuera des recherches web en temps réel pour fournir des informations plus récentes et précises.

## Fonctionnalités

- ✅ Intégration avec l'API OpenAI Responses
- ✅ Recherche web automatique avec l'outil `web_search`
- ✅ Support des modèles `gpt-4o` et `gpt-4o-mini`
- ✅ Extraction des sources de recherche web
- ✅ Analyse structurée des réponses
- ✅ Fallback gracieux en cas d'erreur
- ✅ Compatibilité avec les autres providers

## Architecture

### Nouveaux fichiers

1. **`lib/openai-web-search.ts`** - Module dédié à la recherche web OpenAI
2. **`scripts/test-openai-web-search.ts`** - Script de test pour valider l'implémentation
3. **`docs/OPENAI_WEB_SEARCH.md`** - Cette documentation

### Fichiers modifiés

1. **`lib/ai-utils-enhanced.ts`** - Intégration de la recherche web OpenAI
2. **`lib/provider-config.ts`** - Mise à jour des commentaires de configuration
3. **`lib/types.ts`** - Enrichissement de `AIResponse` (champ `webSearchSources`, détails de détection)
4. **`package.json`** - Ajout/maj du package `openai`

### Flux détaillé

1. L’UI active `useWebSearch` pour le provider OpenAI (toggle coté interface).
2. `analyzePromptWithOpenAIWebSearch` construit un prompt renforcé (oblige la section « Sources consultées »).
3. Appel `client.responses.create({ model, tools: [{ type: "web_search" }], input, max_output_tokens })`.
4. Vérification de `output_text` puis extraction des sources par chemins multiples et annotations.
5. Analyse structurée via `chat.completions.create` (JSON) pour extraire rankings/sentiment/mentions.
6. Détection renforcée par variations de marque (`createSmartBrandVariations` + IA si multi-mots).
7. Retour d’un `AIResponse` incluant `webSearchSources` et métadonnées utiles.

## Utilisation

### Activation automatique

La recherche web OpenAI s'active automatiquement lorsque :
- Le provider est `OpenAI`
- Le paramètre `useWebSearch` est `true`
- La clé API OpenAI est configurée

### Dans le code

```typescript
import { analyzePromptWithProvider } from '@/lib/ai-utils-enhanced';

// La recherche web s'active automatiquement avec useWebSearch=true
const result = await analyzePromptWithProvider(
  "Quels sont les meilleurs outils de monitoring en 2024?",
  "OpenAI",
  "BrandWatch",
  ["Mention", "Hootsuite"],
  false, // useMockMode
  true,  // useWebSearch - Active la recherche web
  "fr"   // locale
);

// result.webSearchSources contient les sources utilisées
console.log(`Sources trouvées: ${result.webSearchSources?.length || 0}`);
```

### Interface utilisateur

Le toggle `useWebSearch` dans l'interface active automatiquement la recherche web pour OpenAI :

```jsx
<WebSearchToggle
  enabled={useWebSearch}
  onChange={handleWebSearchToggle}
  disabled={analyzing}
/>
```

## Configuration

### Variables d'environnement

```bash
# Requis pour la recherche web OpenAI
OPENAI_API_KEY=your_openai_api_key_here
```

### Modèles supportés

- `gpt-4o` (recommandé)
- `gpt-4o-mini` (par défaut)
- `gpt-4o-2024-08-06`
- `gpt-4o-mini-2024-07-18`

## API OpenAI Responses

### Structure de l'appel

```typescript
const response = await client.responses.create({
  model: "gpt-4o-mini",
  tools: [
    { type: "web_search" }
  ],
  input: prompt,
  temperature: 0.7,
  max_output_tokens: 800,
});
```

### Réponse

```typescript
{
  output_text: "Réponse générée avec informations web",
  web_search_call: {
    action: {
      sources: [
        {
          title: "Titre de la source",
          url: "https://example.com",
          // ... autres métadonnées
        }
      ]
    }
  }
}
```

### Extraction des sources

Pour robustesse, l’extraction couvre plusieurs chemins potentiels de la réponse, plus une analyse du texte:

```ts
const webSearchSources: any[] = [];

// 1) Chemins standards potentiels
if ((response as any).web_search_call?.action?.sources) {
  webSearchSources.push(...(response as any).web_search_call.action.sources);
} else if ((response as any).sources) {
  webSearchSources.push(...(response as any).sources);
} else if ((response as any).search_results) {
  webSearchSources.push(...(response as any).search_results);
} else if ((response as any).output?.sources) {
  webSearchSources.push(...(response as any).output.sources);
}

// 2) Annotations
if ((response as any).annotations) {
  for (const a of (response as any).annotations) {
    if (a.type === 'citation' || a.url) {
      webSearchSources.push({ url: a.url || a.source, title: a.title || 'Citation', type: 'annotation' });
    }
  }
}

// 3) Section "Sources consultées:" dans le texte
const text = response.output_text || '';
const section = text.match(/Sources consultées?:[\s\S]*$/i)?.[0];
if (section) {
  for (const url of section.match(/https?:\/\/[^\s\)]+/g) || []) {
    webSearchSources.push({ url: url.replace(/[.,;)]+$/, ''), title: 'Source from response text', type: 'extracted' });
  }
}

// 4) URLs partout dans le texte si rien trouvé
if (webSearchSources.length === 0) {
  for (const url of (text.match(/https?:\/\/[^\s\)]+/g) || [])) {
    webSearchSources.push({ url: url.replace(/[.,;)]+$/, ''), title: 'URL found in response', type: 'url_extraction' });
  }
}
```

### Détection de marque et compétiteurs

- Normalisation et variations simples pour marques simples.
- Variations IA pour marques multi-mots: `createAIBrandVariations()`.
- Filtrage intelligent des termes génériques: `filterBrandVariations()`.
- Détection renforcée utilisée à la fois après l’analyse structurée et en fallback texte.

## Tests

### Script de test

```bash
# Exécuter le script de test
npx tsx scripts/test-openai-web-search.ts
```

### Test manuel dans l'interface

1. Activer le toggle "Recherche en ligne"
2. Lancer une analyse
3. Vérifier que OpenAI utilise des informations récentes
4. Observer les sources web dans les logs

## Gestion des erreurs

### Fallback gracieux

- Si l'API Key n'est pas configurée → Fallback vers OpenAI standard
- Si le modèle ne supporte pas la recherche → Utilise `gpt-4o-mini`
- Si l'API Responses échoue → Retourne `null` pour skip le provider

### Logs de débogage

```typescript
console.log('[OpenAI Web Search] Starting analysis with model: gpt-4o-mini');
console.log('[OpenAI Web Search] Web search sources found: 3');
```

## Performances

### Temps de réponse

- Recherche web : ~3-8 secondes
- Sans recherche web : ~1-3 secondes
- Timeout automatique : 30 secondes

### Coût

- La recherche web peut augmenter le coût des tokens
- Les sources web sont incluses dans le contexte
- Recommandé d'utiliser `gpt-4o-mini` pour optimiser les coûts

## Compatibilité

### Autres providers

- **Anthropic** : Utilise `anthropic-web-search.ts` (existant)
- **Google** : Support natif avec `useSearchGrounding`
- **Perplexity** : Recherche web intégrée par défaut

### Versions

- OpenAI SDK : `^4.0.0`
- AI SDK : `^4.3.17`
- Node.js : `>=18.0.0`

## Dépannage

### Problèmes courants

1. **"OPENAI_API_KEY not configured"**
   - Vérifier `.env.local`
   - Redémarrer le serveur de développement

2. **"Model does not support web search"**
   - Utiliser `gpt-4o` ou `gpt-4o-mini`
   - Vérifier la documentation OpenAI

3. **Pas de sources web**
   - Vérifier la connectivité internet
   - Essayer avec un prompt différent

### Logs de débogage

Activer les logs détaillés :

```typescript
// Dans ai-utils-enhanced.ts
console.log(`[OpenAI] Using OpenAI web search implementation`);
```

## Roadmap

### Améliorations futures

- [ ] Cache des résultats de recherche web
- [ ] Configuration personnalisée des outils de recherche
- [ ] Support des recherches géolocalisées
- [ ] Métriques de performance détaillées
- [ ] Interface pour visualiser les sources web

## Références

- [OpenAI Web Search Documentation](https://platform.openai.com/docs/guides/tools-web-search?api-mode=responses)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [AI SDK Documentation](https://sdk.vercel.ai/)
