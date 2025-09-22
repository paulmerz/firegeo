import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function ObjectifPage() {
  const t = useTranslations('docs.objectif');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p>{t('p1')}</p>

      <h2>{t('results.title')}</h2>
      <ul>
        <li>{t('results.li1')}</li>
        <li>{t('results.li2')}</li>
        <li>{t('results.li3').replace('AIResponse', 'AIResponse')}</li>
      </ul>

      <h2>{t('map.title')}</h2>
      <ul>
        <li>
          {t('map.orchestrator')} <code>lib/ai-utils-enhanced.ts</code>
        </li>
        <li>
          {t('map.openai.label')} <Link href="/docs/openai-web-search">{t('map.openai.link')}</Link> — {t('map.openai.impl')}{' '}
          <code>lib/openai-web-search.ts</code>
        </li>
        <li>
          {t('map.perplexity')} <code>lib/competitor-pipeline/ai-web-search.ts</code>
        </li>
        <li>
          {t('map.model')} <code>AIResponse</code> {t('map.in')} <code>lib/types.ts</code>
        </li>
      </ul>

      <h2>{t('more.title')}</h2>
      <p>
        {t.rich('more.p1', {
          prompts: (chunks) => <Link href="/docs/prompts">{chunks}</Link>,
          lecture: (chunks) => <Link href="/docs/lecture-resultats">{chunks}</Link>
        })}
      </p>
    </div>
  );
}


