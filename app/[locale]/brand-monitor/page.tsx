'use client';

import { BrandMonitor } from '@/components/brand-monitor/brand-monitor';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useCustomer, useRefreshCustomer } from '@/hooks/useAutumnCustomer';
import { useBrandAnalyses, useBrandAnalysis, useDeleteBrandAnalysis } from '@/hooks/useBrandAnalyses';
import { useCreditsInvalidation } from '@/hooks/useCreditsInvalidation';
import { Button } from '@/components/ui/button';
import type { BrandAnalysisWithSourcesAndCompany } from '@/lib/db/schema';
import type { Analysis as BrandAnalysis } from '@/lib/brand-monitor-reducer';

// Type étendu pour inclure analysisData
type BrandAnalysisWithAnalysisData = BrandAnalysisWithSourcesAndCompany & {
  analysisData?: BrandAnalysis | null;
  latestRun?: {
    id: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    visibilityScore: number | null;
    competitorsCount: number | null;
    promptsCount: number | null;
  } | null;
};
import { format } from 'date-fns';
import { useSession } from '@/lib/auth-client';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

// Removed direct Product typing to accommodate varying shapes from Autumn

// Separate component that uses Autumn hooks
function BrandMonitorContent() {
  const router = useRouter();
  useParams();
  const t = useTranslations();
  const { customer, error } = useCustomer();
  const refreshCustomer = useRefreshCustomer();
  const { invalidateCredits } = useCreditsInvalidation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null);
  
  // Queries and mutations
  const { data: analyses, isLoading: analysesLoading } = useBrandAnalyses();
  const { data: currentAnalysis } = useBrandAnalysis(selectedAnalysisId);
  const deleteAnalysis = useDeleteBrandAnalysis();
  const analysesList: BrandAnalysisWithAnalysisData[] = analyses ?? [];
  const renderAnalysisItem = (
    item: BrandAnalysisWithAnalysisData
  ): ReactElement => {
    return (
      <div
        key={item.id}
        className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
          selectedAnalysisId === item.id ? 'bg-gray-100' : ''
        }`}
        onClick={() => setSelectedAnalysisId(item.id)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {item.analysisName || item.company?.name || t('brandMonitor.untitledAnalysis')}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {item.company?.url || item.company?.name || ''}
            </p>
            <p className="text-xs text-gray-400">
              {item.createdAt && format(new Date(item.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAnalysis(item.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  // Get credits from customer data
  const messageUsage = customer?.features?.credits;
  const credits = messageUsage ? (messageUsage.balance || 0) : 0;

  // Determine active plan name/id
  // Autumn customer products can have different shapes; use safe accessors
  const products = (customer?.products ?? []) as unknown[];
  const getStatus = (p: unknown): string | undefined => {
    if (p && typeof p === 'object' && 'status' in p) {
      const s = (p as Record<string, unknown>).status;
      return typeof s === 'string' ? s : undefined;
    }
    return undefined;
  };
  const getNameOrId = (p: unknown): string | undefined => {
    if (p && typeof p === 'object') {
      const obj = p as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name : undefined;
      const id = typeof obj.id === 'string' ? obj.id : undefined;
      return name ?? id;
    }
    return undefined;
  };
  const activeProduct = products.find((p) => {
    const s = getStatus(p);
    return s === 'active' || s === 'trialing' || s === 'past_due';
  }) ?? products[0];
  // DEV-only plan override via footer select
  const [devPlanOverride, setDevPlanOverride] = useState<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const read = () => {
      try {
        const v = localStorage.getItem('devPlanOverride');
        setDevPlanOverride(v);
      } catch {}
    };
    read();
    const handler = () => read();
    window.addEventListener('dev-plan-override-changed', handler);
    return () => window.removeEventListener('dev-plan-override-changed', handler);
  }, []);

  const effectivePlanName: string = ((devPlanOverride && process.env.NODE_ENV === 'development')
    ? devPlanOverride
    : (getNameOrId(activeProduct) || '')) as string;
  const activePlanName: string = effectivePlanName;
  const isStartPlan = activePlanName.toLowerCase().includes('start') || activePlanName.toLowerCase().includes('free');

  useEffect(() => {
    // If there's an auth error, redirect to login
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'AUTH_ERROR') {
      router.push('/login');
    }
  }, [error, router]);

  const handleCreditsUpdate = async () => {
    // Use the global refresh to update customer data everywhere
    await refreshCustomer();
    // Also invalidate React Query cache for credits
    await invalidateCredits();
  };
  
  const handleDeleteAnalysis = async (analysisId: string) => {
    setAnalysisToDelete(analysisId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (analysisToDelete) {
      await deleteAnalysis.mutateAsync(analysisToDelete);
      if (selectedAnalysisId === analysisToDelete) {
        setSelectedAnalysisId(null);
      }
      setAnalysisToDelete(null);
    }
  };
  
  const handleNewAnalysis = () => {
    logger.info('🆕 [BrandMonitorPage] New Analysis button clicked');
    setSelectedAnalysisId(null);
    setResetCount((c) => c + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-[calc(100vh-4rem)] relative">
        {/* Sidebar Toggle Button - Always visible */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute top-2 z-10 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 ${
            sidebarOpen ? 'left-[324px]' : 'left-4'
          }`}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-gray-600" />
          ) : (
            <Menu className="h-5 w-5 text-gray-600" />
          )}
        </button>

        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r overflow-hidden flex flex-col transition-all duration-200`}>
          <div className="p-4 border-b">
            <Button
              onClick={handleNewAnalysis}
              className="w-full btn-firecrawl-orange"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('brandMonitor.newAnalysis')}
            </Button>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {analysesLoading ? (
              <div className="p-4 text-center text-gray-500">{t('brandMonitor.loadingAnalyses')}</div>
            ) : analysesList.length === 0 ? (
              <div className="p-4 text-center text-gray-500">{t('brandMonitor.noAnalysesYet')}</div>
            ) : (
              <div className="space-y-1 p-2">
                {analysesList.map(renderAnalysisItem)}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 sm:px-8 lg:px-12 py-8">
            <BrandMonitor 
              key={`brand-monitor-${resetCount}`}
              creditsAvailable={credits} 
              onCreditsUpdate={handleCreditsUpdate}
              selectedAnalysis={selectedAnalysisId ? currentAnalysis : null}
              onSaveAnalysis={(savedAnalysis) => {
                // Mettre à jour l'analyse sélectionnée immédiatement
                if (savedAnalysis) {
                  setSelectedAnalysisId(savedAnalysis.id);
                }
              }}
              // UI gating by plan
              hideSourcesTab={isStartPlan}
              hideWebSearchSources={isStartPlan}
            />
          </div>
        </div>
      </div>
      
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('brandMonitor.deleteAnalysis')}
        description={t('brandMonitor.deleteAnalysisDesc')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        isLoading={deleteAnalysis.isPending}
      />
    </div>
  );
}

import { logger } from '@/lib/logger';

export default function BrandMonitorPage() {
  const { data: session, isPending } = useSession();
  const t = useTranslations();
  const [isClient, setIsClient] = useState(false);

  // Prevent hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state during hydration and session check
  if (!isClient || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t('brandMonitor.pleaseLogIn')}</p>
        </div>
      </div>
    );
  }

  return <BrandMonitorContent />;
}