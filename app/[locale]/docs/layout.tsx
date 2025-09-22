"use client";
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type Props = {
  children: React.ReactNode;
};

export default function DocsLayout({ children }: Props) {
  const pathname = usePathname();
  const t = useTranslations('docs.nav');
  const navItems = [
    { href: '/docs', label: t('intro') },
    { href: '/docs/objectif', label: t('objectif') },
    { href: '/docs/prompts', label: t('prompts') },
    { href: '/docs/lecture-resultats', label: t('lecture') },
    { href: '/docs/credits', label: t('credits') },
    { href: '/docs/recharger-credits', label: t('recharge') },
    { href: '/docs/openai-web-search', label: t('openaiWebSearch') }
  ];

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3">
            <nav className="sticky top-24 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:text-zinc-50 dark:hover:bg-zinc-900'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <section className="lg:col-span-9 min-w-0">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}


