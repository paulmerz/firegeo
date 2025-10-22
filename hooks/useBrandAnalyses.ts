import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import type { BrandAnalysisWithSources } from '@/lib/db/schema';

export function useBrandAnalyses() {
  const { data: session } = useSession();
  
  return useQuery<BrandAnalysisWithSources[]>({
    queryKey: ['brandAnalyses', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/brand-monitor/analyses');
      if (!res.ok) {
        throw new Error('Failed to fetch brand analyses');
      }
      return res.json();
    },
    enabled: !!session?.user?.id,
  });
}

export function useBrandAnalysis(analysisId: string | null) {
  const { data: session } = useSession();
  
  return useQuery<BrandAnalysisWithSources>({
    queryKey: ['brandAnalysis', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/brand-monitor/analyses/${analysisId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch brand analysis');
      }
      return res.json();
    },
    enabled: !!session?.user?.id && !!analysisId,
  });
}

export function useSaveBrandAnalysis() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  
  return useMutation({
    mutationFn: async (analysisData: Partial<BrandAnalysisWithSources>) => {
      const res = await fetch('/api/brand-monitor/analyses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
      });
      
      if (!res.ok) {
        throw new Error('Failed to save brand analysis');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandAnalyses', session?.user?.id] });
    },
  });
}

export function useDeleteBrandAnalysis() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  
  return useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await fetch(`/api/brand-monitor/analyses/${analysisId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete brand analysis');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandAnalyses', session?.user?.id] });
    },
  });
}

export function useAnalysisTemplates() {
  const { data: session } = useSession();
  
  return useQuery<Array<{
    id: string;
    url: string;
    companyName: string | null;
    industry: string | null;
    logo: string | null;
    locale: string;
    competitorCount: number;
    lastAnalyzedAt: Date;
  }>>({
    queryKey: ['analysisTemplates', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/brand-monitor/analysis-templates');
      if (!res.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await res.json();
      return data.templates;
    },
    enabled: !!session?.user?.id,
  });
}