'use client';

import Image from 'next/image';
import { useSession, signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { useCustomer } from '@/hooks/useAutumnCustomer';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

// Separate component that only renders when Autumn is available
function UserCredits() {
  const { data: session } = useSession();
  
  // Ne pas utiliser useCustomer si l'utilisateur n'est pas connecté
  if (!session) {
    return null;
  }

  const userId = (session as any)?.user?.id || (session as any)?.userId || (session as any)?.user?.email;
  const storageKey = userId ? `autumn_credits_${userId}` : undefined;

  const { customer } = useCustomer();
  const t = useTranslations('common');

  const [displayCredits, setDisplayCredits] = useState<number | null>(null);

  // 1) Lecture initiale depuis le cache local si disponible
  useEffect(() => {
    if (!storageKey) return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached != null) {
        const parsed = Number(cached);
        if (!Number.isNaN(parsed)) {
          setDisplayCredits(parsed);
        }
      }
    } catch {}
  }, [storageKey]);

  // 2) Quand Autumn répond, on met à jour l'état et le cache
  useEffect(() => {
    const creditsUsage = customer?.features?.credits;
    const balance = creditsUsage?.balance;
    if (typeof balance === 'number' && balance >= 0) {
      setDisplayCredits(balance);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(balance));
        } catch {}
      }
    }
  }, [customer, storageKey]);

  // 3) Si aucune valeur (ni cache ni Autumn), masquer pour éviter clignotement à 0
  if (displayCredits == null) {
    return null;
  }

  return (
    <div className="flex items-center text-sm font-medium text-gray-700">
      <span>{displayCredits}</span>
      <span className="ml-1">{t('credits')}</span>
    </div>
  );
}

export function Navbar() {
  const { data: session, isPending } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();

  // Éviter l'erreur d'hydratation en s'assurant que le rendu côté client
  // correspond au rendu côté serveur
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Rediriger vers la page de connexion après déconnexion
      router.replace('/login');
      setIsLoggingOut(false);
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={isClient && session ? `/brand-monitor` : `/`} locale={locale} className="flex items-center">
              <Image
                src="/logo_voxum.svg"
                alt="VOXUM"
                width={120}
                height={25}
                priority
              />
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isClient && session && (
              <>
                {/* <Link
                  href={`/chat`}
                  locale={locale}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {t('common.chat')}
                </Link> */}
                <Link
                  href={`/brand-monitor`}
                  locale={locale}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {t('common.brandMonitor')}
                </Link>
              </>
            )}
            {!(isClient && session) && (
              <Link
                href={`/plans`}
                locale={locale}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {t('common.pricing')}
              </Link>
            )}
            {isClient && session && (
              <UserCredits />
            )}
            {isPending ? (
              <div className="text-sm text-gray-400">{t('common.loading')}</div>
            ) : isClient && session ? (
              <>
                <Link
                  href={`/dashboard`}
                  locale={locale}
                  className="btn-firecrawl-orange inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-8 px-3"
                >
                  {t('common.dashboard')}
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="btn-firecrawl-default inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 h-8 px-3"
                >
                  {isLoggingOut ? t('auth.signingOut') : t('common.logout')}
                </button>
              </>
            ) : (
              <>
                <Link 
                  href={`/login`}
                  locale={locale}
                  className="bg-black text-white hover:bg-gray-800 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-8 px-3 shadow-sm hover:shadow-md"
                >
                  {t('common.login')}
                </Link>
                <Link 
                  href={`/register`}
                  locale={locale}
                  className="btn-firecrawl-orange inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-8 px-3"
                >
                  {t('common.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}