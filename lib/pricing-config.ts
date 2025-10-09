import { StaticProduct } from '@/components/pricing-section';

/**
 * Configuration centralisée des produits de tarification.
 * Cette fonction retourne la configuration des produits utilisée par
 * la homepage et la page /plans pour éviter toute duplication.
 * 
 * @param t - Fonction de traduction de next-intl
 * @returns Configuration des produits de tarification
 */
export function getPricingProducts(t: (key: string) => string): StaticProduct[] {

  const products: StaticProduct[] = [
    {
      id: 'start',
      name: t('pricing.voxum.start.name'),
      price: { 
        primaryText: t('pricing.voxum.start.price'), 
        secondaryText: t('pricing.voxum.start.priceDesc') 
      },
      items: [
        { primaryText: t('pricing.voxum.start.feature1') },
        { primaryText: t('pricing.voxum.start.feature2') },
        { primaryText: t('pricing.voxum.start.feature3') },
      ],
    },
    {
      id: 'watch',
      name: t('pricing.voxum.watch.name'),
      recommendText: t('home.pricing.mostPopular'),
      price: { 
        primaryText: t('pricing.voxum.watch.price'), 
        secondaryText: t('pricing.voxum.watch.priceDesc') 
      },
      items: [
        { primaryText: t('pricing.voxum.watch.feature1') },
        { primaryText: t('pricing.voxum.watch.feature2') },
        { primaryText: t('pricing.voxum.watch.feature3') },
        { primaryText: t('pricing.voxum.watch.feature4') },
        { primaryText: t('pricing.voxum.watch.feature5') },
      ],
    },
    {
      id: 'pro',
      name: t('pricing.voxum.pro.name'),
      price: { 
        primaryText: t('pricing.voxum.pro.price'), 
        secondaryText: t('pricing.voxum.pro.priceDesc') 
      },
      items: [
        { primaryText: t('pricing.voxum.pro.feature1') },
        { primaryText: t('pricing.voxum.pro.feature2') },
        { primaryText: t('pricing.voxum.pro.feature3') },
      ],
    },
    {
      id: 'enterprise',
      name: t('pricing.voxum.enterprise.name'),
      price: { 
        primaryText: t('pricing.voxum.enterprise.price') 
      },
      items: [
        { primaryText: t('pricing.voxum.enterprise.feature1') },
        { primaryText: t('pricing.voxum.enterprise.feature2') },
        { primaryText: t('pricing.voxum.enterprise.feature3') },
      ],
    },
  ];

  // NOTE: Surcharge CHF désactivée pour l'instant (on reste en EUR partout).
  // Pour réactiver l'affichage CHF pour les locales suisses, décommentez le bloc ci-dessous.

  return products;
}

