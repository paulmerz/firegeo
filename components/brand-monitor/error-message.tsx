import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface ErrorMessageProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorMessage({ error, onDismiss }: ErrorMessageProps) {
  const tErrors = useTranslations('brandMonitor.errors');
  
  // Détecter si c'est une erreur de crédits insuffisants
  const isInsufficientCreditsError = 
    error.includes('Crédits insuffisants') || 
    error.includes('Insufficient credits');

  return (
    <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in max-w-md">
      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        <span className="text-sm">{error}</span>
        {isInsufficientCreditsError && (
          <>
            {' '}
            <Link 
              href="/dashboard" 
              className="text-sm font-medium text-red-800 hover:text-red-900 underline"
              onClick={onDismiss}
            >
              {tErrors('buyCreditsLink')}
            </Link>
          </>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}