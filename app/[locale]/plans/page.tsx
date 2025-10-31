'use client';

import { useLocale, useTranslations } from 'next-intl';
import PricingSection from '@/components/pricing-section';
import { getPricingProducts } from '@/lib/pricing-config';

export default function PricingPage() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-[3rem] lg:text-[4.5rem] font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-tr from-orange-600 to-orange-400 bg-clip-text text-transparent">
              {t('pricing.simpleTransparentPricing')}
            </span>
          </h1>
          <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
            {t('pricing.choosePerfectPlan')}
          </p>
        </div>

        <div className="bg-white rounded-[20px] shadow-xl p-8 border border-zinc-200">
          <PricingSection
            showHeader={false}
            products={getPricingProducts(t)}
          />
        </div>
      </div>
    </div>
  );
}