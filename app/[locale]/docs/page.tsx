import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function DocsIntroPage() {
  const t = useTranslations('docs');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('intro.title')}</h1>
      <p>{t('intro.p1')}</p>

      <Card className="my-6">
        <CardHeader>
          <CardTitle>{t('intro.features.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6">
            <li>{t('intro.features.li1')}</li>
            <li>{t('intro.features.li2')}</li>
            <li>{t('intro.features.li3')}</li>
            <li>{t('intro.features.li4')}</li>
          </ul>
        </CardContent>
      </Card>

      <h2>{t('architecture.title')}</h2>
      <ul>
        <li>
          {t('architecture.orchestrator')} <code>lib/ai-utils-enhanced.ts</code>
        </li>
        <li>
          {t('architecture.openai.label')} <Link href="/docs/openai-web-search">{t('architecture.openai.link')}</Link> — {t('architecture.openai.impl')}{' '}
          <code>lib/openai-web-search.ts</code>
        </li>
        <li>
          {t('architecture.perplexity')} <code>lib/competitor-pipeline/ai-web-search.ts</code>
        </li>
        <li>
          {t('architecture.outputModel')} <code>AIResponse</code> {t('architecture.in')} <code>lib/types.ts</code>
        </li>
      </ul>

      <h2>{t('gettingStarted.title')}</h2>
      <ol className="list-decimal pl-6">
        <li>
          {t.rich('gettingStarted.step1', {
            objectif: (chunks) => <Link href="/docs/objectif">{chunks}</Link>
          })}
        </li>
        <li>
          {t.rich('gettingStarted.step2', {
            prompts: (chunks) => <Link href="/docs/prompts">{chunks}</Link>
          })}
        </li>
        <li>
          {t.rich('gettingStarted.step3', {
            openai: (chunks) => <Link href="/docs/openai-web-search">{chunks}</Link>
          })}
        </li>
        <li>
          {t.rich('gettingStarted.step4', {
            lecture: (chunks) => <Link href="/docs/lecture-resultats">{chunks}</Link>
          })}
        </li>
      </ol>
    </div>
  );
}


