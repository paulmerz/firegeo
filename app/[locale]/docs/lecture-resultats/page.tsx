import { useTranslations } from 'next-intl';

export default function LectureResultatsPage() {
  const t = useTranslations('docs.lecture');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p>{t('p1').replace('AIResponse', 'AIResponse').replace('CompanyRanking', 'CompanyRanking')}</p>

      <h2>{t('structure.title').replace('AIResponse', 'AIResponse')}</h2>
      <ul>
        <li>{t('structure.li1')}</li>
        <li>{t('structure.li2').replace('CompanyRanking', 'CompanyRanking')}</li>
        <li>{t('structure.li3')}</li>
        <li>{t('structure.li4')}</li>
        <li>{t('structure.li5')}</li>
        <li>{t('structure.li6')}</li>
      </ul>

      <h2>{t('rankings.title')}</h2>
      <p>{t('rankings.p1')}</p>

      <h2>{t('sources.title')}</h2>
      <p>{t('sources.p1')}</p>

      <h2>{t('scores.title')}</h2>
      <ul>
        <li>{t.rich('scores.li1')}</li>
        <li>{t.rich('scores.li2')}</li>
      </ul>
    </div>
  );
}


