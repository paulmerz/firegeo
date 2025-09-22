'use client';

import { useTranslations } from 'next-intl';
import PricingSection from '@/components/pricing-section';

export default function PricingPage() {
  const t = useTranslations();

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
            products={[
              {
                id: 'start',
                name: t('pricing.voxum.start.name'),
                price: { primaryText: t('pricing.voxum.start.price'), secondaryText: t('pricing.voxum.start.priceDesc') },
                items: [
                  { primaryText: t('pricing.voxum.start.feature1') },
                  { primaryText: t('pricing.voxum.start.feature2') },
                ],
              },
              {
                id: 'watch',
                name: t('pricing.voxum.watch.name'),
                recommendText: t('home.pricing.mostPopular'),
                price: { primaryText: t('pricing.voxum.watch.price'), secondaryText: t('pricing.voxum.watch.priceDesc') },
                items: [
                  { primaryText: t('pricing.voxum.watch.feature1') },
                  { primaryText: t('pricing.voxum.watch.feature2') },
                ],
              },
              {
                id: 'pro',
                name: t('pricing.voxum.pro.name'),
                price: { primaryText: t('pricing.voxum.pro.price'), secondaryText: t('pricing.voxum.pro.priceDesc') },
                items: [
                  { primaryText: t('pricing.voxum.pro.feature1') },
                  { primaryText: t('pricing.voxum.pro.feature2') },
                  { primaryText: t('pricing.voxum.pro.feature3') },
                ],
              },
              {
                id: 'enterprise',
                name: t('pricing.voxum.enterprise.name'),
                price: { primaryText: t('pricing.voxum.enterprise.price') },
                items: [
                  { primaryText: t('pricing.voxum.enterprise.feature1') },
                  { primaryText: t('pricing.voxum.enterprise.feature2') },
                  { primaryText: t('pricing.voxum.enterprise.feature3') },
                ],
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}