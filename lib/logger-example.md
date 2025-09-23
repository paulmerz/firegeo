# Utilisation du Logger

## Configuration automatique

Le logger s'adapte automatiquement à l'environnement :

- **Développement** (`NODE_ENV !== 'production'`) : Tous les logs sont affichés
- **Production** (`NODE_ENV === 'production'`) : Seuls les `warn` et `error` sont affichés

## Exemples d'utilisation

```typescript
import { logger } from './logger';

// Messages de debug (uniquement en développement)
logger.debug('Détails de debug pour le développeur');
logger.debug('Configuration chargée:', { apiKey: '***', timeout: 5000 });

// Messages informatifs (uniquement en développement)  
logger.info('Opération réussie');
logger.info('Analyse terminée:', { responses: 5, duration: '2.3s' });

// Avertissements (toujours affichés)
logger.warn('Configuration manquante, utilisation des valeurs par défaut');
logger.warn('Provider non configuré:', { provider: 'OpenAI' });

// Erreurs (toujours affichées)
logger.error('Échec de connexion à l\'API');
logger.error('Erreur lors de l\'analyse:', error);
```

## Migration depuis console.log

### Avant
```typescript
console.log('Debug info:', data);           // ❌ Affiché en production
console.log('Operation completed');         // ❌ Affiché en production  
console.warn('Warning message');            // ✅ OK
console.error('Error occurred:', error);    // ✅ OK
```

### Après
```typescript
logger.debug('Debug info:', data);          // ✅ Masqué en production
logger.info('Operation completed');         // ✅ Masqué en production
logger.warn('Warning message');             // ✅ Toujours affiché
logger.error('Error occurred:', error);     // ✅ Toujours affiché
```

## Avantages

1. **Performance** : Pas de processing inutile des logs en production
2. **Sécurité** : Évite les fuites d'informations sensibles 
3. **Lisibilité** : Code plus propre avec des niveaux explicites
4. **Maintenance** : Contrôle centralisé du logging
