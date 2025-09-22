import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function RechargerCreditsPage() {
  const t = useTranslations('docs.recharge');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p>{t('p1')}</p>
      <p>{t.rich('p2', { plans: (c) => <Link href="/plans">{c}</Link> })}</p>
      <h2>{t('best.title')}</h2>
      <ul>
        <li>{t('best.li1')}</li>
        <li>{t('best.li2')}</li>
        <li>{t('best.li3')}</li>
      </ul>
    </div>
  );
}


