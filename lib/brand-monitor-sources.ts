import { AnalysisSource, AIResponse } from './types';

type UnknownObject = Record<string, unknown>;

export function extractUrlsFromText(text: string): string[] {
  // Match http/https URLs; avoid trailing punctuation
  const httpRegex = /https?:\/\/[^\s)\]}>'"`]+/gi;
  const httpMatches = text.match(httpRegex) || [];

  // Match markdown links [label](url)
  const mdLinkRegex = /\[[^\]]+\]\(((?:https?:\/\/)[^\s)]+)\)/gi;
  const mdMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mdLinkRegex.exec(text)) !== null) {
    if (m[1]) mdMatches.push(m[1]);
  }

  // Footnote-style definitions: [1]: https://...
  const footnoteDefRegex = /^\[(?:\d+|[a-zA-Z]+)\]:\s*(https?:\/\/[^\s)]+)\s*$/gim;
  const footnoteDefs: string[] = [];
  while ((m = footnoteDefRegex.exec(text)) !== null) {
    if (m[1]) footnoteDefs.push(m[1]);
  }

  // Inline citations like: [1] Title (https://...)
  const inlineCitationRegex = /\[(?:\d+|[a-zA-Z]+)\][^\n]*?\((https?:\/\/[^\s)]+)\)/gim;
  const inlineCitations: string[] = [];
  while ((m = inlineCitationRegex.exec(text)) !== null) {
    if (m[1]) inlineCitations.push(m[1]);
  }

  // Match bare domains (avoid emails). e.g., example.com/path
  // Require a real TLD (>=2 letters) to avoid false positives like "f.p"
  const bareDomainRegex = /\b(?!mailto:)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\.[a-z]{2,})(?:\/[\w\-._~:\/?#[\]@!$&'()*+,;=%]*)?)\b/gi;
  const domainMatches = (text.match(bareDomainRegex) || []).filter((s) => s.includes('.'));

  const matches = [...httpMatches, ...mdMatches, ...footnoteDefs, ...inlineCitations, ...domainMatches];
  const cleaned = matches
    .map((u) => u.replace(/[),.;:!?]+$/g, ''))
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of cleaned) {
    const normalized = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function asTrimmedString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

// Removed unused function

function getHostnameFromUrl(url: string): string | undefined {
  try {
    const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const { hostname } = new URL(normalized);
    return hostname.replace(/^www\./i, '') || hostname;
  } catch {
    return undefined;
  }
}

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
    const domain = getHostnameFromUrl(urlCandidate);
    return {
      provider: context.provider,
      prompt: context.prompt,
      url: urlCandidate,
      domain,
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
  const title = asTrimmedString(raw['title']);
  // Note: snippet field removed from database schema
  const sourceType = determineSourceType(raw) || 'web_search';
  const metadata = raw as UnknownObject;
  const id = asTrimmedString(raw['id'] || raw['sourceId']);
  const createdAt = asTrimmedString(raw['createdAt']);

  // Déduire le domaine à partir de l'URL si pas fourni explicitement
  const domain = asTrimmedString(raw['domain'] || raw['hostname']) || 
    (url ? getHostnameFromUrl(url) : undefined);

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
    title,
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

      // 1) Sources structurées si disponibles (chemin historique)
      addRawSources(webSearchSources, { provider, prompt, analysisId: currentAnalysisId });

      // 1.b) Nouvelles URLs structurées extraites des réponses (AIResponse.urls)
      const structuredUrls = responseObj['urls'];
      if (Array.isArray(structuredUrls)) {
        structuredUrls.forEach((u: unknown, index: number) => {
          if (u && typeof u === 'object') {
            const url = asTrimmedString((u as Record<string, unknown>)['url']);
            const title = asTrimmedString((u as Record<string, unknown>)['title']);
            if (url) {
              registerSource(
                normalizeSource({ url, title } as UnknownObject, {
                  provider: provider,
                  prompt: prompt,
                  rank: index + 1,
                  analysisId: currentAnalysisId,
                })
              );
            }
          }
        });
      }

      // 2) Fallback: extraire des URLs directement du texte de réponse
      const responseText = asTrimmedString(responseObj['response']);
      if (responseText) {
        const urls = extractUrlsFromText(responseText);
        if (urls.length > 0) {
          urls.forEach((url, index) => {
            registerSource(
              normalizeSource(url, {
                provider: provider,
                prompt: prompt,
                rank: index + 1,
                analysisId: currentAnalysisId,
              })
            );
          });
        }
      }
    });
  }

  // Return in stable order of insertion
  return Array.from(collectedByKey.values());
}
