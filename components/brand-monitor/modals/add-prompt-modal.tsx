import React from 'react';
import { useTranslations } from 'next-intl';

interface AddPromptModalProps {
  isOpen: boolean;
  promptText: string;
  onPromptTextChange: (text: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddPromptModal({
  isOpen,
  promptText,
  onPromptTextChange,
  onAdd,
  onClose
}: AddPromptModalProps) {
  const t = useTranslations('brandMonitor');
  
  if (!isOpen) return null;
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && promptText.trim()) {
      e.preventDefault();
      onAdd();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 animate-fade-in">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('addCustomPrompt')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('addCustomPromptDesc')}
          </p>
          <textarea
            value={promptText}
            onChange={(e) => onPromptTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('addCustomPromptPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-3 mt-6">
            <button
              onClick={onAdd}
              disabled={!promptText.trim()}
              className="flex-1 h-10 px-4 rounded-[10px] text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 bg-orange-500 text-white hover:bg-orange-300 dark:bg-orange-500 dark:hover:bg-orange-300 dark:text-white [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#c2410c,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#c2410c,_0px_1px_3px_0px_rgba(234,_88,_12,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#c2410c,_0px_1px_2px_0px_rgba(234,_88,_12,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100"
            >
              {t('addPrompt')}
            </button>
            <button
              onClick={onClose}
              className="px-4 h-10 rounded-[10px] text-sm font-medium transition-all duration-200 bg-[#36322F] text-[#fff] hover:bg-[#4a4542] [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)]"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}