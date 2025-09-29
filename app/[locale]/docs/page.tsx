"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { marked } from 'marked';

const sectionsConfig = [
  { id: 'introduction', fr: '/docs/introduction/fr.md', en: '/docs/introduction/en.md', label: { fr: 'Introduction', en: 'Introduction' } },
  { id: 'features', fr: '/docs/key-features/fr.md', en: '/docs/key-features/en.md', label: { fr: 'Fonctionnalités clés', en: 'Key features' } },
  { id: 'getting-started', fr: '/docs/getting-started/fr.md', en: '/docs/getting-started/en.md', label: { fr: 'Bien démarrer', en: 'Getting started' } },
  { id: 'prompts', fr: '/docs/prompts/fr.md', en: '/docs/prompts/en.md', label: { fr: 'Prompts efficaces', en: 'Effective prompts' } },
  { id: 'reading-results', fr: '/docs/reading-results/fr.md', en: '/docs/reading-results/en.md', label: { fr: 'Lire les résultats', en: 'Reading results' } },
  { id: 'credits', fr: '/docs/credits/fr.md', en: '/docs/credits/en.md', label: { fr: 'Crédits', en: 'Credits' } },
  { id: 'openai-web-search', fr: '/docs/openai-web-search/fr.md', en: '/docs/openai-web-search/en.md', label: { fr: 'OpenAI Web Search', en: 'OpenAI Web Search' } },
];

export default function DocsPage() {
  const routeParams = useParams<{ locale?: string }>();
  const [active, setActive] = useState<string>('introduction');
  const [htmlById, setHtmlById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>("");
  const [locale, setLocale] = useState<'fr'|'en'>(routeParams?.locale === 'en' ? 'en' : 'fr');

  useEffect(() => {
    const l = window.location.pathname.split('/')[1] || 'fr';
    setLocale((['fr','en'] as const).includes(l as any) ? (l as 'fr'|'en') : 'fr');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const { default: DOMPurify } = await import('isomorphic-dompurify');
        const entries = await Promise.all(
          sectionsConfig.map(async (s) => {
            const path = locale === 'fr' ? s.fr : s.en;
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
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load docs');
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [locale]);

  const labelFor = (id: string) => {
    const s = sectionsConfig.find(x => x.id === id)!;
    return s.label[locale as 'fr'|'en'];
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


