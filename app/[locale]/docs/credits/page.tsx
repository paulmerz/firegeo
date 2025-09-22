import { useTranslations } from 'next-intl';

export default function CreditsPage() {
  const t = useTranslations('docs.credits');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p>{t('p1')}</p>

      <h2>{t('factors.title')}</h2>
      <ul>
        <li>{t.rich('factors.li1')}</li>
        <li>{t('factors.li2')}</li>
        <li>{t('factors.li3').replace('gpt-4o-mini', 'gpt-4o-mini')}</li>
      </ul>

      <h2>{t('orders.title')}</h2>
      <ul>
        <li>{t('orders.li1')}</li>
        <li>{t('orders.li2')}</li>
        <li>{t('orders.li3')}</li>
      </ul>

      <h2>{t('tracking.title')}</h2>
      <p>{t('tracking.p1')}</p>
    </div>
  );
}


