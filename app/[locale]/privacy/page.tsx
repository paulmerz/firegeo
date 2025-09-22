'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <article className="prose prose-lg prose-zinc max-w-none dark:prose-invert prose-a:text-orange-600 hover:prose-a:text-orange-700 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-headings:scroll-mt-28 prose-h2:mt-10 prose-h3:mt-6 prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">

      <h2 className="mb-2">{t('title')}</h2>
      <p>{t('intro.p1')}</p>
      <p>{t('intro.p2')}</p>
      <p>{t('intro.p3')}</p>

      <h2 id="overview">{t('h.overview')}</h2>
      <p>{t('overview.p1')}</p>
      <ul>
        <li>{t('overview.li1')}</li>
        <li>{t('overview.li2')}</li>
        <li>{t('overview.li3')}</li>
      </ul>
      <p>{t('overview.p2')}</p>

      <h2 id="donnees">{t('h.data')}</h2>
      <h3>{t('data.h31')}</h3>
      <ul>
        <li>{t('data.li1')}</li>
        <li>{t('data.li2')}</li>
        <li>{t('data.li3')}</li>
        <li>{t('data.li4')}</li>
      </ul>
      <h3>{t('data.h32')}</h3>
      <ul>
        <li>{t('data.li5')}</li>
        <li>{t('data.li6')}</li>
      </ul>
      <h3>{t('data.h33')}</h3>
      <ul>
        <li>{t('data.li7')}</li>
        <li>{t('data.li8')}</li>
      </ul>
      <p><em>{t('data.note')}</em></p>

      <h2 id="bases">{t('h.bases')}</h2>
      <ul>
        <li>{t('bases.li1')}</li>
        <li>{t('bases.li2')}</li>
        <li>{t('bases.li3')}</li>
        <li>{t('bases.li4')}</li>
      </ul>
      <p>{t('bases.p1')}</p>

      <h2 id="finalites">{t('h.purposes')}</h2>
      <ul>
        <li>{t('purposes.li1')}</li>
        <li>{t('purposes.li2')}</li>
        <li>{t('purposes.li3')}</li>
        <li>{t('purposes.li4')}</li>
        <li>{t('purposes.li5')}</li>
        <li>{t('purposes.li6')}</li>
      </ul>

      <h2 id="partage">{t('h.sharing')}</h2>
      <p>{t('sharing.p1')}</p>
      <ul>
        <li>{t('sharing.li1')}</li>
        <li>{t('sharing.li2')}</li>
        <li>{t('sharing.li3')}</li>
      </ul>
      <p>{t('sharing.p2')}</p>

      <h2 id="transferts">{t('h.transfers')}</h2>
      <p>{t('transfers.p1')}</p>

      <h2 id="durees">{t('h.retention')}</h2>
      <ul>
        <li>{t('retention.li1')}</li>
        <li>{t('retention.li2')}</li>
        <li>{t('retention.li3')}</li>
        <li>{t('retention.li4')}</li>
        <li>{t('retention.li5')}</li>
      </ul>
      <p>{t('retention.p1')}</p>

      <h2 id="cookies">{t('h.cookies')}</h2>
      <ul>
        <li>{t('cookies.li1')}</li>
        <li>{t('cookies.li2')}</li>
        <li>{t('cookies.li3')}</li>
      </ul>
      <p>{t('cookies.p1')}</p>

      <h2 id="droits">{t('h.rights')}</h2>
      <ul>
        <li>{t('rights.li1')}</li>
        <li>{t('rights.li2')}</li>
        <li>{t('rights.li3')}</li>
      </ul>
      <p>{t('rights.p1')}</p>

      <h2 id="securite">{t('h.security')}</h2>
      <p>{t('security.p1')}</p>

      <h2 id="roles">{t('h.roles')}</h2>
      <ul>
        <li>{t('roles.li1')}</li>
        <li>{t('roles.li2')}</li>
        <li>{t('roles.li3')}</li>
      </ul>
      <p>{t('roles.p1')}</p>

      <h2 id="enfants">{t('h.children')}</h2>
      <p>{t('children.p1')}</p>

      <h2 id="contact">{t('h.contact')}</h2>
      <p className="whitespace-pre-line">
        {t.rich('contact.p1', {
          strong: (chunks) => <strong>{chunks}</strong>,
          em: (chunks) => <em>{chunks}</em>
        })}
      </p>

      <h2 id="annexe">{t('h.appendix')}</h2>
      <div className="overflow-x-auto rounded-[12px] border border-zinc-200 dark:border-zinc-800">
        <table className="w-full table-auto">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-800/50">{t('appendix.th1')}</th>
              <th className="px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-800/50">{t('appendix.th2')}</th>
              <th className="px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-800/50">{t('appendix.th3')}</th>
              <th className="px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-800/50">{t('appendix.th4')}</th>
              <th className="px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-800/50">{t('appendix.th5')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.neon.name')}</td>
              <td className="px-4 py-3">{t('appendix.neon.role')}</td>
              <td className="px-4 py-3">{t('appendix.neon.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.neon.loc')}</td>
              <td className="px-4 py-3">{t('appendix.neon.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.openai.name')}</td>
              <td className="px-4 py-3">{t('appendix.openai.role')}</td>
              <td className="px-4 py-3">{t('appendix.openai.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.openai.loc')}</td>
              <td className="px-4 py-3">{t('appendix.openai.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.anthropic.name')}</td>
              <td className="px-4 py-3">{t('appendix.anthropic.role')}</td>
              <td className="px-4 py-3">{t('appendix.anthropic.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.anthropic.loc')}</td>
              <td className="px-4 py-3">{t('appendix.anthropic.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.perplexity.name')}</td>
              <td className="px-4 py-3">{t('appendix.perplexity.role')}</td>
              <td className="px-4 py-3">{t('appendix.perplexity.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.perplexity.loc')}</td>
              <td className="px-4 py-3">{t('appendix.perplexity.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.firecrawl.name')}</td>
              <td className="px-4 py-3">{t('appendix.firecrawl.role')}</td>
              <td className="px-4 py-3">{t('appendix.firecrawl.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.firecrawl.loc')}</td>
              <td className="px-4 py-3">{t('appendix.firecrawl.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.google.name')}</td>
              <td className="px-4 py-3">{t('appendix.google.role')}</td>
              <td className="px-4 py-3">{t('appendix.google.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.google.loc')}</td>
              <td className="px-4 py-3">{t('appendix.google.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.stripe.name')}</td>
              <td className="px-4 py-3">{t('appendix.stripe.role')}</td>
              <td className="px-4 py-3">{t('appendix.stripe.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.stripe.loc')}</td>
              <td className="px-4 py-3">{t('appendix.stripe.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.autumn.name')}</td>
              <td className="px-4 py-3">{t('appendix.autumn.role')}</td>
              <td className="px-4 py-3">{t('appendix.autumn.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.autumn.loc')}</td>
              <td className="px-4 py-3">{t('appendix.autumn.data')}</td>
            </tr>
            <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-3">{t('appendix.vercel.name')}</td>
              <td className="px-4 py-3">{t('appendix.vercel.role')}</td>
              <td className="px-4 py-3">{t('appendix.vercel.purpose')}</td>
              <td className="px-4 py-3">{t('appendix.vercel.loc')}</td>
              <td className="px-4 py-3">{t('appendix.vercel.data')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}