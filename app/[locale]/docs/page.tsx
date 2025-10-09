"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { marked } from 'marked';

const sectionsConfig = [
  { id: 'introduction', fr: '/docs/introduction/fr.md', en: '/docs/introduction/en.md', de: '/docs/introduction/de.md', label: { fr: 'Introduction', en: 'Introduction', de: 'Einführung' } },
  { id: 'features', fr: '/docs/key-features/fr.md', en: '/docs/key-features/en.md', de: '/docs/key-features/de.md', label: { fr: 'Fonctionnalités clés', en: 'Key features', de: 'Hauptmerkmale' } },
  { id: 'getting-started', fr: '/docs/getting-started/fr.md', en: '/docs/getting-started/en.md', de: '/docs/getting-started/de.md', label: { fr: 'Bien démarrer', en: 'Getting started', de: 'Erste Schritte' } },
  { id: 'prompts', fr: '/docs/prompts/fr.md', en: '/docs/prompts/en.md', de: '/docs/prompts/de.md', label: { fr: 'Prompts efficaces', en: 'Effective prompts', de: 'Effektive Prompts' } },
  { id: 'reading-results', fr: '/docs/reading-results/fr.md', en: '/docs/reading-results/en.md', de: '/docs/reading-results/de.md', label: { fr: 'Lire les résultats', en: 'Reading results', de: 'Ergebnisse lesen' } },
  { id: 'credits', fr: '/docs/credits/fr.md', en: '/docs/credits/en.md', de: '/docs/credits/de.md', label: { fr: 'Crédits', en: 'Credits', de: 'Credits' } },
  { id: 'openai-web-search', fr: '/docs/openai-web-search/fr.md', en: '/docs/openai-web-search/en.md', de: '/docs/openai-web-search/de.md', label: { fr: 'OpenAI Web Search', en: 'OpenAI Web Search', de: 'OpenAI Web Search' } },
];

export default function DocsPage() {
  const routeParams = useParams<{ locale?: string }>();
  const [active, setActive] = useState<string>('introduction');
  const [htmlById, setHtmlById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>("");
  const [locale, setLocale] = useState<'fr'|'en'|'de'>(() => {
    const l = routeParams?.locale;
    if (l === 'en') return 'en';
    if (l === 'de') return 'de';
    return 'fr';
  });

  useEffect(() => {
    const l = window.location.pathname.split('/')[1] || 'fr';
    if (l === 'en') setLocale('en');
    else if (l === 'de') setLocale('de');
    else setLocale('fr');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const { default: DOMPurify } = await import('isomorphic-dompurify');
        const entries = await Promise.all(
          sectionsConfig.map(async (s) => {
            const path = locale === 'de' ? s.de : locale === 'fr' ? s.fr : s.en;
            const res = await fetch(path, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
            const md = await res.text();
            const parsed = marked.parse(md) as string;
            const clean = DOMPurify.sanitize(parsed);
            return [s.id, clean as string] as const;
          })
        );
        if (!cancelled) {
          const map: Record<string,string> = {};
          for (const [k,v] of entries) map[k] = v;
          setHtmlById(map);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load docs';
          setError(message);
        }
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [locale]);

  const labelFor = (id: string) => {
    const s = sectionsConfig.find(x => x.id === id)!;
    return s.label[locale];
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3">
            <nav className="sticky top-24 space-y-1">
              {sectionsConfig.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={`block w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${active===s.id? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100':'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:text-zinc-50 dark:hover:bg-zinc-900'}`}
                ><h2>{labelFor(s.id)}</h2></a>
              ))}
            </nav>
          </aside>
          <section className="lg:col-span-9 min-w-0">
            {error ? (
              <div className="prose prose-zinc dark:prose-invert max-w-none">{error}</div>
            ) : (
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                {sectionsConfig.map(s => (
                  <article key={s.id} id={s.id} className="scroll-mt-24">
                    <h1 className="text-2xl font-semibold mb-2">{labelFor(s.id)}</h1>
                    <div dangerouslySetInnerHTML={{ __html: htmlById[s.id] || '' }} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


