'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { CREDIT_COST_PER_PROMPT_ANALYSIS_WEB, CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB } from '@/config/constants';

interface WebSearchToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function WebSearchToggle({ enabled, onChange, disabled }: WebSearchToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
        ${enabled 
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={`${enabled ? CREDIT_COST_PER_PROMPT_ANALYSIS_WEB : CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB} ${ (enabled ? CREDIT_COST_PER_PROMPT_ANALYSIS_WEB : CREDIT_COST_PER_PROMPT_ANALYSIS_NO_WEB) > 1 ? 'crédits' : 'crédit' } / prompt analysé`}
    >
      {enabled ? (
        <>
          <Globe className="w-4 h-4" />
          Web Search On
        </>
      ) : (
        <>
          <Globe className="w-4 h-4 opacity-50" />
          Web Search Off
        </>
      )}
    </button>
  );
}