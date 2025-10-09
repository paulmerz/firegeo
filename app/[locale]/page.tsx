'use client';

import { Link } from "@/i18n/routing";
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import PricingSection from '@/components/pricing-section';
import InteractiveDemo from '@/components/interactive-demo';
import { getPricingProducts } from '@/lib/pricing-config';

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const t = useTranslations();
  useParams();

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-16 pb-24">
        
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 animate-fade-in-up">
              <span className="block text-zinc-900">{t('home.hero.title')}</span>
              <span className="block bg-gradient-to-r from-red-600 to-yellow-500 bg-clip-text text-transparent">
                {t('home.hero.subtitle')}
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-zinc-600 max-w-3xl mx-auto mb-6 animate-fade-in-up animation-delay-200">
              {t('home.hero.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-400">
              <Link
                href={`/register?plan=free`}
                className="btn-firecrawl-orange inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-base font-medium transition-all duration-200 h-12 px-8"
              >
                {t('home.hero.startAnalysis')}
              </Link>
              <Link
                href={`/plans`}
                className="btn-firecrawl-default inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-base font-medium transition-all duration-200 h-12 px-8"
              >
                {t('home.hero.viewPricing')}
              </Link>
            </div>
            <p className="mt-6 text-sm text-zinc-500 animate-fade-in-up animation-delay-600">
              {t('home.hero.features')}
            </p>
          </div>

          {/* Stats */}
          <div className="mt-20 bg-zinc-900 rounded-[20px] p-12 animate-fade-in-scale animation-delay-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="text-center animate-fade-in-up animation-delay-1000">
                <div className="text-4xl font-bold text-white">{t('home.stats.aiModels.title')}</div>
                <div className="text-sm text-zinc-400 mt-1">{t('home.stats.aiModels.description')}</div>
              </div>
              <div className="text-center animate-fade-in-up animation-delay-1000" style={{animationDelay: '1200ms'}}>
                <div className="text-4xl font-bold text-white">{t('home.stats.competitor.title')}</div>
                <div className="text-sm text-zinc-400 mt-1">{t('home.stats.competitor.description')}</div>
              </div>
              <div className="text-center animate-fade-in-up animation-delay-1000" style={{animationDelay: '1100ms'}}>
                <div className="text-4xl font-bold text-white">{t('home.stats.realtime.title')}</div>
                <div className="text-sm text-zinc-400 mt-1">{t('home.stats.realtime.description')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InteractiveDemo />

      <PricingSection products={getPricingProducts(t)} />


      {/* CTA Section 1 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-[30px] p-16 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              {t('home.cta1.title')}
            </h2>
            <p className="text-xl text-orange-100 mb-8">
              {t('home.cta1.description')}
            </p>
             <Link
               href={`/register?plan=free`}
               className="btn-firecrawl-orange inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-base font-medium transition-all duration-200 h-12 px-8"
             >
               {t('home.cta1.button')}
             </Link>
          </div>
        </div>
      </section>


      {/* FAQs */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4 animate-fade-in-up">
              {t('home.faq.title')}
            </h2>
            <p className="text-xl text-zinc-600 animate-fade-in-up animation-delay-200">
              {t('home.faq.description')}
            </p>
          </div>

          <div className="space-y-4">
            {/* FAQ 1 */}
            <div className="bg-gray-50 rounded-[15px] overflow-hidden animate-fade-in-up animation-delay-400">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t('home.faq.questions.howItWorks.question')}
                </h3>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === 0 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 0 && (
                <div className="px-6 py-6">
                  <p className="text-zinc-600 leading-relaxed">
                    {t('home.faq.questions.howItWorks.answer')}
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="bg-gray-50 rounded-[15px] overflow-hidden animate-fade-in-up animation-delay-400" style={{animationDelay: '500ms'}}>
              <button
                onClick={() => toggleFaq(1)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t('home.faq.questions.providers.question')}
                </h3>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === 1 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 1 && (
                <div className="px-6 py-6">
                  <p className="text-zinc-600 leading-relaxed">
                    {t('home.faq.questions.providers.answer')}
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="bg-gray-50 rounded-[15px] overflow-hidden animate-fade-in-up animation-delay-600">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t('home.faq.questions.updates.question')}
                </h3>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === 2 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 2 && (
                <div className="px-6 py-6">
                  <p className="text-zinc-600 leading-relaxed">
                    {t('home.faq.questions.updates.answer')}
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 4 */}
            <div className="bg-gray-50 rounded-[15px] overflow-hidden animate-fade-in-up animation-delay-400" style={{animationDelay: '700ms'}}>
              <button
                onClick={() => toggleFaq(3)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t('home.faq.questions.insights.question')}
                </h3>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === 3 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 3 && (
                <div className="px-6 py-6">
                  <p className="text-zinc-600 leading-relaxed">
                    {t('home.faq.questions.insights.answer')}
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 5 */}
            <div className="bg-gray-50 rounded-[15px] overflow-hidden animate-fade-in-up animation-delay-800">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t('home.faq.questions.credits.question')}
                </h3>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === 4 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 4 && (
                <div className="px-6 py-6">
                  <p className="text-zinc-600 leading-relaxed">
                    {t('home.faq.questions.credits.answer')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-zinc-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            {t('home.finalCta.title')}
          </h2>
          <p className="text-xl text-zinc-400 mb-8">
            {t('home.finalCta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/register?plan=free`}
              className="btn-firecrawl-orange inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-base font-medium transition-all duration-200 h-12 px-8"
            >
              {t('home.finalCta.analyzeButton')}
            </Link>
            <Link
              href={`/plans`}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-base font-medium transition-all duration-200 h-12 px-8 bg-zinc-800 text-white hover:bg-zinc-700"
            >
              {t('home.finalCta.pricingButton')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
