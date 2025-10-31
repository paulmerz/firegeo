'use client';

import React, { useState } from 'react';
// import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  History, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  CreditCard,
  Users,
  FileText
} from 'lucide-react';
import { getStatusBadgeColor, getStatusText, type RunStatus } from '@/lib/scheduling-utils';
import type { BrandAnalysisRun } from '@/lib/db/schema';

interface RunsHistoryTabProps {
  analysisId: string;
}

interface RunWithSources extends BrandAnalysisRun {
  sources?: Array<{
    id: string;
    provider?: string;
    url?: string;
    sourceType?: string;
  }>;
}

export function RunsHistoryTab({ analysisId }: RunsHistoryTabProps) {
  const [runs, setRuns] = useState<RunWithSources[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunWithSources | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Charger les runs
  React.useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/brand-monitor/analyses/${analysisId}/runs`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch runs');
        }
        
        const data = await response.json();
        const runsData = (data.runs ?? []) as RunWithSources[];
        const sortedRuns = runsData
          .slice()
          .sort((a, b) => {
            const toTimestamp = (value?: string | Date | null) => {
              if (!value) return 0;
              const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
              return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
            };
            return toTimestamp(b.startedAt) - toTimestamp(a.startedAt);
          });
        setRuns(sortedRuns.slice(0, 15));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [analysisId]);

  const handleViewDetails = async (runId: string) => {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const response = await fetch(`/api/brand-monitor/analyses/${analysisId}/runs/${runId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch run details');
      }
      
      const data = await response.json();
      setSelectedRun(data.run);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Erreur lors du chargement des détails');
    }
    setDetailsLoading(false);
  };

  const handleRunSelection = async (run: RunWithSources) => {
    setSelectedRun(run);
    setIsDialogOpen(true);
    await handleViewDetails(run.id);
  };

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'insufficient_credits':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Chargement de l&apos;historique...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <p className="text-red-600">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des Exécutions
          </CardTitle>
          <CardDescription>
            Consultez l&apos;historique des exécutions automatiques de cette analyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Aucune exécution enregistrée</p>
              <p className="text-sm text-gray-500 mt-1">
                Les exécutions automatiques apparaîtront ici une fois le scheduling activé
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Crédits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRunSelection(run)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void handleRunSelection(run);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {run.startedAt ? new Date(run.startedAt).toLocaleDateString('fr-FR') : '-'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {run.startedAt ? new Date(run.startedAt).toLocaleTimeString('fr-FR') : '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {run.status && getStatusIcon(run.status)}
                          <Badge 
                            variant="outline" 
                            className={run.status ? getStatusBadgeColor(run.status) : 'bg-gray-100'}
                          >
                            {run.status ? getStatusText(run.status) : 'Unknown'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.startedAt && run.completedAt ? (
                          <span className="text-sm">
                            {Math.round(
                              (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000 / 60
                            )} min
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span className="text-sm">{run.creditsUsed || 0}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedRun(null);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l&apos;exécution</DialogTitle>
            <DialogDescription>
              {selectedRun?.startedAt
                ? `Exécution du ${new Date(selectedRun.startedAt).toLocaleString('fr-FR')}`
                : 'Exécution'}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Clock className="w-6 h-6 animate-spin text-gray-400" />
              <p className="text-sm text-gray-600">Chargement des détails...</p>
            </div>
          )}

          {!detailsLoading && detailsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Erreur</h4>
              <p className="text-sm text-red-700">{detailsError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (selectedRun) {
                    void handleViewDetails(selectedRun.id);
                  }
                }}
              >
                Réessayer
              </Button>
            </div>
          )}

          {!detailsLoading && !detailsError && selectedRun && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Statut</h4>
                  <div className="flex items-center gap-2">
                    {selectedRun.status && getStatusIcon(selectedRun.status)}
                    <Badge className={selectedRun.status ? getStatusBadgeColor(selectedRun.status) : 'bg-gray-100'}>
                      {selectedRun.status ? getStatusText(selectedRun.status) : 'Unknown'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Crédits utilisés</h4>
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    <span>{selectedRun.creditsUsed || 0}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Score de visibilité</h4>
                  <span className="text-lg font-bold text-orange-600">
                    {selectedRun.visibilityScore || 0}%
                  </span>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Concurrents analysés</h4>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{selectedRun.competitorsCount || 0}</span>
                  </div>
                </div>
              </div>

              {selectedRun.errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Erreur</h4>
                  <p className="text-sm text-red-700">{selectedRun.errorMessage}</p>
                </div>
              )}

              {selectedRun.sources && selectedRun.sources.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Sources ({selectedRun.sources.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedRun.sources.map((source) => (
                      <div 
                        key={source.id}
                        className="p-3 border rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{source.provider || 'Source inconnue'}</p>
                            <p className="text-xs text-gray-600">{source.url}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {source.sourceType || 'web_search'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
