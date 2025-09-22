'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <article className="prose prose-lg prose-zinc max-w-none dark:prose-invert prose-a:text-orange-600 hover:prose-a:text-orange-700 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-headings:scroll-mt-28 prose-h2:mt-10 prose-h3:mt-6 prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">
      <h2 className="mb-2">{t('title')}</h2>

      <h2 id="general">{t('nav.general')}</h2>
      <p>{t('content.general.p1')}</p>
      <p>{t('content.general.p2')}</p>
      <p>{t('content.general.p3')}</p>
      <p>{t('content.general.p4')}</p>

      <h2 id="personal">{t('nav.personal')}</h2>
      <p>{t('content.personal.p1')}</p>

      <h2 id="access">{t('nav.access')}</h2>
      <p>{t('content.access.p1')}</p>
      <p>{t('content.access.p2')}</p>

      <h2 id="features">{t('nav.features')}</h2>
      <p>{t('content.features.p1')}</p>
      <p>{t('content.features.p2')}</p>
      <p>{t('content.features.p3')}</p>

      <h2 id="ip">{t('nav.ip')}</h2>
      <p>{t('content.ip.p1')}</p>
      <p>{t('content.ip.p2')}</p>
      <p>{t('content.ip.p3')}</p>

      <h2 id="restrictions">{t('nav.restrictions')}</h2>
      <p>{t('content.restrictions.p1')}</p>

      <h2 id="privacy">{t('nav.privacy')}</h2>
      <p>{t('content.privacy.p1')}</p>

      <h2 id="changes">{t('nav.changes')}</h2>
      <p>{t('content.changes.p1')}</p>

      <h2 id="warranty">{t('nav.warranty')}</h2>
      <p>{t('content.warranty.p1')}</p>

      <h2 id="liability">{t('nav.liability')}</h2>
      <p>{t('content.liability.p1')}</p>

      <h2 id="indemnification">{t('nav.indemnification')}</h2>
      <p>{t('content.indemnification.p1')}</p>

      <h2 id="misc">{t('nav.misc')}</h2>
      <p>{t('content.misc.p1')}</p>

      <h2 id="law">{t('nav.law')}</h2>
      <p>{t('content.law.p1')}</p>

      <h2 id="contact">{t('nav.contact')}</h2>
      <p className="whitespace-pre-line">{t('content.contact.p1')}</p>
    </article>
  );
}


