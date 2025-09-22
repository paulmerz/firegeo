import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function PromptsPage() {
  const t = useTranslations('docs.prompts');
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p>{t('p1').replace('AIResponse', 'AIResponse')}</p>

      <h2>{t('types.title').replace('PROMPT_TEMPLATES', 'PROMPT_TEMPLATES')}</h2>
      <ol className="list-decimal pl-6">
        <li>{t.rich('types.ranking', { link: (c) => <Link href="/docs/lecture-resultats">{c}</Link> })}</li>
        <li>{t('types.comparison').replace('{brand}', '{brand}').replace('{competitors}', '{competitors}')}</li>
        <li>{t('types.alternatives').replace('{brand}', '{brand}')}</li>
        <li>{t('types.recommendations')}</li>
      </ol>

      <h2>{t('examples.title')}</h2>
      <h3>{t('examples.ex1')}</h3>
      <pre className="whitespace-pre-wrap border rounded-lg p-4 text-sm bg-zinc-50 dark:bg-zinc-900">Catégorie: running
Pays: France
Objectif: découvrir des marques tendances en 2025 pour débutants
Contraintes: prix &lt; 120€, disponibilité e-commerce FR, bonnes notes avis</pre>

      <h3>{t('examples.ex2')}</h3>
      <pre className="whitespace-pre-wrap border rounded-lg p-4 text-sm bg-zinc-50 dark:bg-zinc-900">Leader: Nike Pegasus
Alternatives: 5 options maximum
Critères: amorti, stabilité, poids, prix, retours utilisateurs
Contexte: coureur occasionnel, 10km/semaine</pre>

      <h3>{t('examples.ex3')}</h3>
      <pre className="whitespace-pre-wrap border rounded-lg p-4 text-sm bg-zinc-50 dark:bg-zinc-900">Usage: chaussures de sport pour débuter la course
Budget: 70–120€
Profil: débutant, 70 kg, 2 séances de 30 min/semaine
Préférences: confort &gt; performance, modèle polyvalent</pre>

      <h2>{t('tech.title')}</h2>
      <ul>
        <li>{t.rich('tech.li1', { link: (c) => <Link href="/docs/openai-web-search">{c}</Link> })}</li>
        <li>{t('tech.li2').replace('gpt-4o-mini', 'gpt-4o-mini').replace('gpt-4o', 'gpt-4o')}</li>
        <li>{t('tech.li3')}</li>
      </ul>

      <h2>{t('best.title')}</h2>
      <ul>
        <li>{t('best.li1')}</li>
        <li>{t('best.li2')}</li>
        <li>{t('best.li3')}</li>
        <li>{t('best.li4')}</li>
      </ul>
    </div>
  );
}


