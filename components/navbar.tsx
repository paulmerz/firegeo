'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCustomer } from '@/hooks/useAutumnCustomer';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

// Separate component that only renders when Autumn is available
function UserCredits() {
  const { data: session } = useSession();
  
  // Ne pas utiliser useCustomer si l'utilisateur n'est pas connecté
  if (!session) {
    return null;
  }
  
  const { customer } = useCustomer();
  const messageUsage = customer?.features?.messages;
  const remainingMessages = messageUsage ? (messageUsage.balance || 0) : 0;
  const t = useTranslations('common');
  
  return (
    <div className="flex items-center text-sm font-medium text-gray-700">
      <span>{remainingMessages}</span>
      <span className="ml-1">{t('credits')}</span>
    </div>
  );
}

export function Navbar() {
  const { data: session, isPending } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Small delay to ensure the session is cleared
      setTimeout(() => {
        router.refresh();
        setIsLoggingOut(false);
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={`/${locale}`} className="flex items-center">
              <Image
                src="/firecrawl-logo-with-fire.webp"
                alt="Firecrawl"
                width={120}
                height={25}
                priority
              />
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {session && (
              <>
                <Link
                  href={`/${locale}/chat`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {t('common.chat')}
                </Link>
                <Link
                  href={`/${locale}/brand-monitor`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {t('common.brandMonitor')}
                </Link>
              </>
            )}
            <Link
              href={`/${locale}/plans`}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('common.pricing')}
            </Link>
            {session && (
              <UserCredits />
            )}
            {isPending ? (
              <div className="text-sm text-gray-400">{t('common.loading')}</div>
            ) : session ? (
              <>
                <Link
                  href={`/${locale}/dashboard`}
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
                  href={`/${locale}/login`}
                  className="bg-black text-white hover:bg-gray-800 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-8 px-3 shadow-sm hover:shadow-md"
                >
                  {t('common.login')}
                </Link>
                <Link 
                  href={`/${locale}/register`}
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