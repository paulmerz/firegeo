'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import StaticPricingTable from '@/components/static-pricing-table';
// NOTE: Le tableau dynamique (Autumn) n'est plus utilisé depuis cette section.
// Si vous devez changer de produit, passez par le Dashboard.
// import PricingTable from '@/components/autumn/pricing-table';

export interface StaticProduct {
  id: string;
  name?: string;
  description?: string;
  recommendText?: string;
  price: {
    primaryText: string;
    secondaryText?: string;
  };
  items: Array<{
    primaryText: string;
    secondaryText?: string;
  }>;
}

interface PricingSectionProps {
  products?: StaticProduct[];
  showHeader?: boolean;
}

export default function PricingSection({ products, showHeader = true }: PricingSectionProps) {
  const t = useTranslations();

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-50 rounded-[30px] p-16">
          {showHeader && (
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-zinc-900 mb-4">
                {t('home.pricing.title')}
              </h2>
              <p className="text-xl text-zinc-600">
                {t('home.pricing.description')}
              </p>
            </div>
          )}

          <div className="bg-white rounded-[20px] p-0 border-0">
            {/* Affichage forcé de la tarification statique.
                L’utilisateur change de produit uniquement depuis le Dashboard. */}
            <StaticPricingTable products={products || []} />
          </div>
        </div>
      </div>
    </section>
  );
}


