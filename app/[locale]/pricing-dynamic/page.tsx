'use client';

import { useCustomer } from '@/hooks/useAutumnCustomer';
import { usePricingTable } from 'autumn-js/react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import ProductChangeDialog from '@/components/autumn/product-change-dialog';
import { useTranslations } from 'next-intl';

type SessionData = ReturnType<typeof useSession>['data'];

// Separate component that uses Autumn hooks
function DynamicPricingContent({ sessionData }: { sessionData: SessionData }) {
  const { customer, attach, refetch } = useCustomer();
  const { products: autumnProducts, isLoading, error } = usePricingTable();
  const router = useRouter();
  const t = useTranslations();

  // Données de pricing depuis les traductions (identiques à la homepage)
  const pricingData = [
    {
      id: 'start',
      name: t('pricing.voxum.start.name'),
      price: t('pricing.voxum.start.price'),
      priceDesc: t('pricing.voxum.start.priceDesc'),
      features: [
        t('pricing.voxum.start.feature1'),
        t('pricing.voxum.start.feature2'),
        t('pricing.voxum.start.feature3'),
        t('pricing.voxum.start.feature4'),
      ],
    },
    {
      id: 'watch',
      name: t('pricing.voxum.watch.name'),
      price: t('pricing.voxum.watch.price'),
      priceDesc: t('pricing.voxum.watch.priceDesc'),
      features: [
        t('pricing.voxum.watch.feature1'),
        t('pricing.voxum.watch.feature2'),
        t('pricing.voxum.watch.feature3'),
      ],
      recommended: true,
    },
    {
      id: 'pro',
      name: t('pricing.voxum.pro.name'),
      price: t('pricing.voxum.pro.price'),
      priceDesc: t('pricing.voxum.pro.priceDesc'),
      features: [
        t('pricing.voxum.pro.feature1'),
        t('pricing.voxum.pro.feature2'),
        t('pricing.voxum.pro.feature3'),
      ],
    },
    {
      id: 'enterprise',
      name: t('pricing.voxum.enterprise.name'),
      price: t('pricing.voxum.enterprise.price'),
      features: [
        t('pricing.voxum.enterprise.feature1'),
        t('pricing.voxum.enterprise.feature2'),
        t('pricing.voxum.enterprise.feature3'),
      ],
    },
  ];

  const handleSelectPlan = async (productId: string) => {
    if (!sessionData) {
      router.push('/login');
      return;
    }

    await attach({
      productId,
      dialog: ProductChangeDialog,
    });
    // Refresh customer data after product change
    await refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{t('errors.generic')}</p>
          <Button onClick={() => window.location.reload()}>{t('common.back')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-50 rounded-[30px] p-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 mb-4">
              {t('home.pricing.title')}
            </h1>
            <p className="text-xl text-zinc-600">
              {t('home.pricing.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricingData.map((plan) => {
              const isActive = autumnProducts?.some(p => p.id === plan.id && customer?.products?.some(cp => cp.id === p.id));
              const autumnProduct = autumnProducts?.find(p => p.id === plan.id);

              return (
                <div 
                  key={plan.id} 
                  className={`bg-white rounded-[20px] shadow-sm border p-8 flex flex-col ${
                    plan.recommended ? 'ring-2 ring-orange-500 relative' : ''
                  }`}
                >
                  {plan.recommended && (
                    <div className="absolute top-4 right-4 bg-black text-white text-sm font-medium px-3 py-1 rounded-full">
                      {t('home.pricing.mostPopular')}
                    </div>
                  )}
                  
                  <h2 className="text-2xl font-semibold mb-4">{plan.name}</h2>
                  
                  <div className="mb-6">
                    <div className="font-semibold flex items-baseline border-y py-4 bg-secondary/40 -mx-8 px-8">
                      <span className="text-3xl">{plan.price}</span>
                      {plan.priceDesc && (
                        <span className="text-gray-600 ml-2 text-base font-normal">
                          {plan.priceDesc}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <Check className="h-4 w-4 text-primary mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isActive || !autumnProduct}
                    className={`w-full ${
                      plan.recommended 
                        ? 'btn-firecrawl-orange' 
                        : 'btn-firecrawl-default'
                    }`}
                  >
                    {isActive ? t('pricing.currentPlan') : t('pricing.getStarted')}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DynamicPricingPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return <DynamicPricingContent sessionData={session} />;
}