'use client';

import React from 'react';
import { ResultsTab } from '@/lib/brand-monitor-reducer';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

interface ResultsNavigationProps {
  activeTab: ResultsTab;
  onTabChange: (tab: ResultsTab) => void;
  onRestart: () => void;
  hideSourcesTab?: boolean;
}

export function ResultsNavigation({
  activeTab,
  onTabChange,
  onRestart,
  hideSourcesTab
}: ResultsNavigationProps) {
  const t = useTranslations('brandMonitor');
  
  const handleTabClick = (tab: ResultsTab) => {
    onTabChange(tab);
  };
  
  return (
    <nav className="w-80 flex-shrink-0 animate-fade-in flex flex-col h-[calc(100vh-8rem)] ml-[-2rem] sticky top-8" style={{ animationDelay: '0.3s' }}>
      
      <div className="w-full flex flex-col justify-between flex-1">
        
        {/* Navigation Tabs - at the top */}
        <div className="space-y-2">
        <button
          onClick={() => handleTabClick('prompts')}
          className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 ${
            activeTab === 'prompts'
              ? 'bg-[#36322F] text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)]'
              : 'bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98]'
          }`}
        >
          {t('resultsNavigation.promptsResponses')}
        </button>
        {hideSourcesTab ? (
          <div className="group relative">
            <button
              disabled
              className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 bg-gray-200 text-gray-500 cursor-not-allowed`}
              aria-disabled="true"
            >
              {t('resultsNavigation.sources')}
            </button>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover:block hover:block z-20">
              <div className="w-56 text-xs bg-white border border-gray-200 rounded-lg shadow-md p-3">
                <div className="font-medium text-gray-900 mb-1">{t('resultsNavigation.upgradeRequiredTitle', { defaultMessage: 'Disponible à partir du plan "Watch"' })}</div>
                <Link href="/dashboard" className="text-orange-600 hover:text-orange-700 underline">
                  {t('resultsNavigation.upgradeCta', { defaultMessage: 'Augmenter mon plan' })}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleTabClick('sources')}
            className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 ${
              activeTab === 'sources'
                ? 'bg-[#36322F] text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)]'
                : 'bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98]'
            }`}
          >
            {t('resultsNavigation.sources')}
          </button>
        )}
        <button
          onClick={() => handleTabClick('matrix')}
          className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 ${
            activeTab === 'matrix'
              ? 'bg-[#36322F] text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)]'
              : 'bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98]'
          }`}
        >
          {t('resultsNavigation.comparisonMatrix')}
        </button>
        <button
          onClick={() => handleTabClick('rankings')}
          className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 ${
            activeTab === 'rankings'
              ? 'bg-[#36322F] text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)]'
              : 'bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98]'
          }`}
        >
          {t('resultsNavigation.providerRankings')}
        </button>
        <button
          onClick={() => handleTabClick('visibility')}
          className={`w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 ${
            activeTab === 'visibility'
              ? 'bg-[#36322F] text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)]'
              : 'bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98]'
          }`}
        >
          {t('resultsNavigation.visibilityScore')}
        </button>
        
        </div>
        
        {/* Analyze another website button - at the bottom */}
        <div className="pt-4 pb-8 border-t border-gray-200">
          <button
            onClick={onRestart}
            className="w-full text-left px-4 py-3 rounded-[10px] text-sm font-medium transition-all duration-200 bg-[#36322F] text-[#fff] hover:bg-[#4a4542] [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('resultsNavigation.analyzeAnotherWebsite')}
          </button>
        </div>
      </div>
    </nav>
  );
}
