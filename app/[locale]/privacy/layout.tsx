"use client";
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  children: React.ReactNode;
};

// IDs map to <h2 id="..."> anchors in page.tsx
const sectionIds = [
  'overview',
  'donnees',
  'bases',
  'finalites',
  'partage',
  'transferts',
  'durees',
  'cookies',
  'droits',
  'securite',
  'roles',
  'enfants',
  'contact',
  'annexe'
] as const;

type SectionId = typeof sectionIds[number];

export default function PrivacyLayout({ children }: Props) {
  const pathname = usePathname();
  const t = useTranslations('privacy.nav');
  const tMain = useTranslations('privacy');
  const [activeHash, setActiveHash] = useState<SectionId>('overview');

  // Locale-aware base path (keeps current locale automatically via Link from i18n/routing)
  const basePath = useMemo(() => (pathname?.split('#')[0] || '/privacy'), [pathname]);

  useEffect(() => {
    const setFromLocation = () => {
      const hash = typeof window !== 'undefined' ? (window.location.hash || '#overview') : '#overview';
      const id = (hash.replace('#', '') || 'overview') as SectionId;
      if (sectionIds.includes(id)) setActiveHash(id);
    };
    setFromLocation();
    window.addEventListener('hashchange', setFromLocation);
    return () => window.removeEventListener('hashchange', setFromLocation);
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-[20px] p-8 md:p-12 text-center text-white shadow-md animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {tMain('title')}
            </h1>
            <p className="text-sm md:text-base text-orange-100">
              {tMain('meta.version', { date: '22 septembre 2025' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3">
            <nav className="sticky top-24 space-y-1 bg-white rounded-[15px] border border-zinc-200 p-3 shadow-sm dark:bg-zinc-900 dark:border-zinc-800" aria-label={t('aria')}>
              {sectionIds.map((id) => {
                const href = `${basePath}#${id}`;
                const active = id === activeHash;
                return (
                  <Link
                    key={id}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:text-zinc-50 dark:hover:bg-zinc-900'
                    )}
                  >
                    {t(id)}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <section className="lg:col-span-9 min-w-0">
            <div className="bg-white rounded-[20px] border border-zinc-200 p-6 md:p-10 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


