# Architecture du Système de Surlignage de Marques

## Vue d'ensemble

Le système de surlignage de marques a été refactorisé pour être plus simple, maintenable et réutilisable.

## Architecture Avant/Après

### Avant (Complexe)
```
HighlightedResponse
├── Logique de détection complexe
├── Gestion des positions de texte
├── Filtrage des matches
├── Création d'éléments DOM
└── Logique de surlignage markdown
```

### Après (Simplifié)
```
HighlightedResponse
├── Configuration simple
├── Utilitaires réutilisables
└── Logique de surlignage simplifiée

lib/brand-highlighting-utils.tsx
├── getBrandHighlightClass()
├── createHighlightedHtml()
├── highlightTextWithBrands()
└── highlightMarkdownChildren()
```

## Composants Principaux

### 1. `lib/brand-highlighting-utils.tsx`
**Utilitaires réutilisables pour le surlignage**

- **`getBrandHighlightClass()`** : Détermine la classe CSS appropriée
- **`createHighlightedHtml()`** : Crée le HTML surligné
- **`highlightTextWithBrands()`** : Surligne un texte simple
- **`highlightMarkdownChildren()`** : Surligne récursivement les enfants React

### 2. `components/brand-monitor/highlighted-response.tsx`
**Composant principal simplifié**

- Configuration centralisée via `BrandHighlightingConfig`
- Utilisation des utilitaires pour le surlignage
- Logique réduite de ~80 lignes à ~15 lignes

## Avantages de la Refactorisation

### ✅ **Simplicité**
- Code plus lisible et compréhensible
- Logique centralisée dans des utilitaires
- Moins de duplication de code

### ✅ **Maintenabilité**
- Séparation des responsabilités
- Utilitaires testables indépendamment
- Configuration centralisée

### ✅ **Réutilisabilité**
- Utilitaires utilisables dans d'autres composants
- Interface claire et documentée
- Types TypeScript pour la sécurité

### ✅ **Performance**
- Moins de recalculs inutiles
- Optimisations React (useMemo, useCallback)
- Logique de surlignage simplifiée

## Configuration

```typescript
const highlightingConfig: BrandHighlightingConfig = {
  targetBrand: "Caterham",
  competitors: ["Lotus", "BMW"],
  targetHighlightClass: "bg-orange-100 text-orange-900",
  competitorHighlightClass: "bg-gray-200 text-gray-900",
  defaultHighlightClass: "bg-gray-100 text-gray-900"
};
```

## Utilisation

### Surlignage de texte simple
```typescript
const highlighted = highlightTextWithBrands(
  text, 
  detectionResults, 
  config, 
  showHighlighting
);
```

### Surlignage de markdown
```typescript
const highlightedChildren = highlightMarkdownChildren(
  children, 
  detectionResults, 
  config, 
  showHighlighting
);
```

## Migration

La refactorisation est **rétrocompatible** :
- Même interface publique
- Même comportement
- Même performance
- Code plus maintenable

## Tests

Tous les tests existants passent :
- ✅ Détection de marques
- ✅ Surlignage correct
- ✅ Gestion des cas edge
- ✅ Performance

