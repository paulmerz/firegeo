import { AnalysisSource, AIResponse } from './types';

type UnknownObject = Record<string, unknown>;

function asTrimmedString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

// Removed unused function

function determineSourceType(raw: UnknownObject | undefined): string | undefined {
  if (!raw) return undefined;
  return (
    asTrimmedString(raw['sourceType']) ||
    asTrimmedString(raw['type']) ||
    asTrimmedString(raw['kind']) ||
    undefined
  );
}

function normalizeSource(
  raw: UnknownObject | string,
  context: { provider?: string; prompt?: string; rank?: number; analysisId?: string }
): AnalysisSource | undefined {
  if (typeof raw === 'string') {
    const urlCandidate = asTrimmedString(raw);
    if (!urlCandidate) {
      return undefined;
    }
    return {
      provider: context.provider,
      prompt: context.prompt,
      url: urlCandidate,
      sourceType: 'web_search',
      rank: context.rank,
    };
  }

  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const provider = context.provider;
  const prompt = context.prompt;
  const url = asTrimmedString(raw['url'] || raw['link'] || raw['source']);
  const domain = asTrimmedString(raw['domain'] || raw['hostname']);
  // Note: snippet field removed from database schema
  const sourceType = determineSourceType(raw) || 'web_search';
  const metadata = raw as UnknownObject;
  const id = asTrimmedString(raw['id'] || raw['sourceId']);
  const createdAt = asTrimmedString(raw['createdAt']);

  if (!url && !domain) {
    return undefined;
  }

  return {
    id,
    analysisId: context.analysisId,
    provider,
    prompt,
    domain,
    url,
    sourceType,
    metadata,
    rank: context.rank,
    createdAt,
  };
}

function createDedupKey(source: AnalysisSource): string | undefined {
  if (source.url) {
    return source.url.trim().toLowerCase();
  }

  const parts = [source.provider, source.prompt, source.domain]
    .map((part) => (part ? part.trim().toLowerCase() : ''));

  const key = parts.join('|');
  return key.trim().length > 0 ? key : undefined;
}

export function extractAnalysisSources(
  analysisData?: unknown,
  persistedSources?: unknown[] | null,
  currentAnalysisId?: string
): AnalysisSource[] {
  // Use a map so we can enrich duplicates (DB entries first, then enrich with runtime context)
  const collectedByKey = new Map<string, AnalysisSource>();

  const registerSource = (maybeSource: AnalysisSource | undefined) => {
    if (!maybeSource) return;
    if (currentAnalysisId && maybeSource.analysisId && maybeSource.analysisId !== currentAnalysisId) {
      // Ignore sources that belong to a different analysis when an ID is provided
      return;
    }
    const key = createDedupKey(maybeSource);
    if (!key) return;

    const normalized: AnalysisSource = {
      ...maybeSource,
      sourceType: maybeSource.sourceType || 'web_search',
    };

    // Debug logs removed to avoid console pollution

    const existing = collectedByKey.get(key);
    if (!existing) {
      collectedByKey.set(key, normalized);
      return;
    }

    // Enrich existing with any missing fields from the new source (prefer existing non-empty)
    const enriched: AnalysisSource = {
      ...existing,
      provider: existing.provider || normalized.provider,
      prompt: existing.prompt || normalized.prompt,
      domain: existing.domain || normalized.domain,
      url: existing.url || normalized.url,
      sourceType: existing.sourceType || normalized.sourceType,
      rank: existing.rank ?? normalized.rank,
      metadata: existing.metadata || normalized.metadata,
      analysisId: existing.analysisId || normalized.analysisId,
      id: existing.id || normalized.id,
      createdAt: existing.createdAt || normalized.createdAt,
    };
    collectedByKey.set(key, enriched);
  };

  const addRawSources = (
    sources: unknown,
    context: { provider?: string; prompt?: string; analysisId?: string }
  ) => {
    if (!Array.isArray(sources)) return;
    sources.forEach((raw, index) => {
      const normalized = normalizeSource(raw as UnknownObject | string, {
        provider: context.provider,
        prompt: context.prompt,
        rank: index + 1,
        analysisId: context.analysisId ?? currentAnalysisId,
      });
      registerSource(normalized);
    });
  };

  if (Array.isArray(persistedSources)) {
    persistedSources.forEach((raw) => {
      const normalized = normalizeSource(raw as UnknownObject, {
        provider: asTrimmedString((raw as UnknownObject)['provider']),
        prompt: asTrimmedString((raw as UnknownObject)['prompt']),
        analysisId: asTrimmedString((raw as UnknownObject)['analysisId']),
      });
      registerSource(normalized);
    });
  }

  if (!analysisData || typeof analysisData !== 'object') {
    return Array.from(collectedByKey.values());
  }

  const analysisObject = analysisData as Record<string, unknown>;

  addRawSources(analysisObject['sources'], {
    provider: undefined,
    prompt: undefined,
  });

  const responses = analysisObject['responses'];
  if (Array.isArray(responses)) {
    (responses as AIResponse[]).forEach((response) => {
      const responseObj = response as unknown as UnknownObject;
      const provider = asTrimmedString(responseObj['provider']);
      const prompt = asTrimmedString(responseObj['prompt']);
      const webSearchSources = responseObj['webSearchSources'];
      
      // Debug logs removed
      addRawSources(webSearchSources, { provider, prompt, analysisId: currentAnalysisId });
    });
  }

  // Return in stable order of insertion
  return Array.from(collectedByKey.values());
}
