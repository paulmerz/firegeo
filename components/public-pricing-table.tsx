'use client';

import { Link } from "@/i18n/routing";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from 'next-intl';

interface Product {
  id: string;
  name: string;
  display?: {
    name?: string;
    description?: string;
    recommend_text?: string;
  };
  properties?: {
    is_free?: boolean;
  };
  items: Array<{
    display?: {
      primary_text?: string;
      secondary_text?: string;
    };
  }>;
}

export function PublicPricingTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations();

  useEffect(() => {
    fetch('/api/autumn/products', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (!res.ok) {
          // If we get a 401, just show static pricing silently
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.products) {
          setProducts(data.products);
        }
        setLoading(false);
      })
      .catch(() => {
        // Silently fall back to static pricing
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // If we can't fetch products (user not logged in), show static pricing
  if (products.length === 0) {
    return (
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Starter */}
        <div className="bg-white p-8 rounded-[20px] border border-zinc-200">
          <h3 className="text-2xl font-bold mb-2">{t('publicPricing.starter.name')}</h3>
          <p className="text-zinc-600 mb-6">{t('publicPricing.starter.description')}</p>
          <div className="mb-6">
            <span className="text-4xl font-bold">{t('publicPricing.starter.price')}</span>
            <span className="text-zinc-600">{t('publicPricing.starter.priceDesc')}</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.starter.feature1')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.starter.feature2')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.starter.feature3')}
            </li>
          </ul>
          <Link
            href={`/register`}
            className="btn-firecrawl-outline w-full inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-10 px-4"
          >
            {t('publicPricing.starter.button')}
          </Link>
        </div>

        {/* Pro - Featured */}
        <div className="bg-white p-8 rounded-[20px] border-2 border-orange-500 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-1 rounded-full text-sm font-medium">
            {t('publicPricing.mostPopular')}
          </div>
          <h3 className="text-2xl font-bold mb-2">{t('publicPricing.pro.name')}</h3>
          <p className="text-zinc-600 mb-6">{t('publicPricing.pro.description')}</p>
          <div className="mb-6">
            <span className="text-4xl font-bold">{t('publicPricing.pro.price')}</span>
            <span className="text-zinc-600">{t('publicPricing.pro.priceDesc')}</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.pro.feature1')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.pro.feature2')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.pro.feature3')}
            </li>
          </ul>
          <Link
            href={`/register`}
            className="btn-firecrawl-orange w-full inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-10 px-4"
          >
            {t('publicPricing.pro.button')}
          </Link>
        </div>

        {/* Enterprise */}
        <div className="bg-white p-8 rounded-[20px] border border-zinc-200">
          <h3 className="text-2xl font-bold mb-2">{t('publicPricing.enterprise.name')}</h3>
          <p className="text-zinc-600 mb-6">{t('publicPricing.enterprise.description')}</p>
          <div className="mb-6">
            <span className="text-4xl font-bold">{t('publicPricing.enterprise.price')}</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.enterprise.feature1')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.enterprise.feature2')}
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('publicPricing.enterprise.feature3')}
            </li>
          </ul>
          <Link
            href={`/contact`}
            className="btn-firecrawl-outline w-full inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-10 px-4"
          >
            {t('publicPricing.enterprise.button')}
          </Link>
        </div>
      </div>
    );
  }

  // If we have products, render them dynamically
  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {products.map((product) => {
        const isRecommended = !!product.display?.recommend_text;
        const mainPrice = product.properties?.is_free
          ? { primary_text: t('publicPricing.free') }
          : product.items[0]?.display;

        return (
          <div
            key={product.id}
            className={`bg-white p-8 rounded-[20px] border ${
              isRecommended ? 'border-2 border-orange-500 relative' : 'border-zinc-200'
            }`}
          >
            {isRecommended && product.display?.recommend_text && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-1 rounded-full text-sm font-medium">
                {product.display.recommend_text}
              </div>
            )}
            <h3 className="text-2xl font-bold mb-2">
              {product.display?.name || product.name}
            </h3>
            {product.display?.description && (
              <p className="text-zinc-600 mb-6">{product.display.description}</p>
            )}
            <div className="mb-6">
              <span className="text-4xl font-bold">
                {mainPrice?.primary_text || '$0'}
              </span>
              {mainPrice?.secondary_text && (
                <span className="text-zinc-600">{mainPrice.secondary_text}</span>
              )}
            </div>
            <ul className="space-y-3 mb-8">
              {product.items.slice(product.properties?.is_free ? 0 : 1).map((item, index) => (
                <li key={index} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item.display?.primary_text}
                </li>
              ))}
            </ul>
            <Link
              href={`/register`}
              className={`${
                isRecommended ? 'btn-firecrawl-orange' : 'btn-firecrawl-outline'
              } w-full inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-10 px-4`}
            >
              {product.properties?.is_free ? t('publicPricing.startFree') : t('publicPricing.getStarted')}
            </Link>
          </div>
        );
      })}
    </div>
  );
}