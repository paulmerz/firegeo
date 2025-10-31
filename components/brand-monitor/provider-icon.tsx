'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type ProviderIconSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<ProviderIconSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-7 h-7'
};

interface ProviderIconProps {
  provider: string;
  size?: ProviderIconSize;
  className?: string;
}

export function ProviderIcon({ provider, size = 'md', className }: ProviderIconProps) {
  const normalizedProvider = (provider || '').toLowerCase();
  const dimensions = sizeClasses[size];

  switch (normalizedProvider) {
    case 'openai':
      return (
        <img
          src="/OpenAI_logo.svg"
          alt="OpenAI"
          className={cn(dimensions, className)}
        />
      );
    case 'anthropic':
      return (
        <img
          src="https://cdn.brandfetch.io/idmJWF3N06/theme/dark/symbol.svg"
          alt="Anthropic"
          className={cn(dimensions, className)}
        />
      );
    case 'google':
      return (
        <div className={cn('flex items-center justify-center', dimensions, className)}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
      );
    case 'perplexity':
      return (
        <img
          src="/Perplexity_logo.svg"
          alt="Perplexity"
          className={cn(dimensions, className)}
        />
      );
    default:
      return <div className={cn('rounded bg-gray-400', dimensions, className)} />;
  }
}

