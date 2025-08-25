'use client';

import PricingTable from '@/components/autumn/pricing-table';
import StaticPricingTable from '@/components/static-pricing-table';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
  const { data: session } = useSession();
  const t = useTranslations();

  const localizedStaticProducts = [
    {
      id: "free",
      name: t('pricing.plans.free.name'),
      description: t('pricing.plans.free.description'),
      price: {
        primaryText: t('pricing.plans.free.price'),
        secondaryText: t('pricing.plans.free.priceDesc')
      },
      items: [
        { 
          primaryText: t('pricing.plans.free.feature1'),
          secondaryText: t('pricing.plans.free.feature1Desc')
        },
        {
          primaryText: t('pricing.plans.free.feature2'),
          secondaryText: t('pricing.plans.free.feature2Desc')
        },
        {
          primaryText: t('pricing.plans.free.feature3'),
          secondaryText: t('pricing.plans.free.feature3Desc')
        }
      ]
    },
    {
      id: "pro",
      name: t('pricing.plans.pro.name'),
      description: t('pricing.plans.pro.description'),
      recommendText: t('pricing.plans.pro.recommendText'),
      price: {
        primaryText: t('pricing.plans.pro.price'),
        secondaryText: t('pricing.plans.pro.priceDesc')
      },
      items: [
        { 
          primaryText: t('pricing.plans.pro.feature1'),
          secondaryText: t('pricing.plans.pro.feature1Desc')
        },
        {
          primaryText: t('pricing.plans.pro.feature2'),
          secondaryText: t('pricing.plans.pro.feature2Desc')
        },
        {
          primaryText: t('pricing.plans.pro.feature3'),
          secondaryText: t('pricing.plans.pro.feature3Desc')
        }
      ]
    }
  ];

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
          {session && (
            <p className="text-sm text-zinc-500 mt-4">
              {t('pricing.loggedInAs')} {session.user?.email}
            </p>
          )}
        </div>

        <div className="bg-white rounded-[20px] shadow-xl p-8 border border-zinc-200">
          {/* Use static component for unauthenticated users to avoid API calls */}
          {session ? (
            <PricingTable />
          ) : (
            <StaticPricingTable products={localizedStaticProducts} />
          )}
        </div>
      </div>
    </div>
  );
}