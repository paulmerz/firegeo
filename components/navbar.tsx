'use client';

import Image from 'next/image';
import { useSession, signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { useCredits } from '@/hooks/useMessages';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

// Separate component that only renders when user is logged in
function UserCredits() {
  const { data: session } = useSession();
  const { data: creditsData, isLoading } = useCredits();
  const t = useTranslations('common');
  
  // Ne pas afficher si l'utilisateur n'est pas connecté
  if (!session) {
    return null;
  }

  // Afficher un indicateur de chargement ou masquer si pas de données
  if (isLoading || !creditsData) {
    return null;
  }

  return (
    <div className="flex items-center text-sm font-medium text-gray-700">
      <span>{creditsData.balance}</span>
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
  const isSessionLoading = !isClient || isPending;

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
            {isSessionLoading ? (
              <div className="text-sm text-gray-400">{t('common.loading')}</div>
            ) : session ? (
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