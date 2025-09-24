'use client';

import Image from 'next/image';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';

export default function VerifyEmailPage() {
  const t = useTranslations('verifyEmail');
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (session?.user) {
      router.replace('/brand-monitor');
    }
  }, [session, router]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Image src="/logo_voxum.svg" alt="VOXUM" width={180} height={37} priority />
        </div>

        <div className="bg-white rounded-xl shadow p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h2>
          <p className="text-gray-600 mb-6">{t('subtitle')}</p>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
            <p className="text-sm text-orange-800">
              {t('hint')}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/" className="btn-firecrawl-orange h-10 px-4 rounded-[10px] text-sm font-medium inline-flex items-center">
              {t('backHome')}
            </Link>
            <Link href="/login" className="h-10 px-4 rounded-[10px] text-sm font-medium border border-gray-300 hover:bg-gray-50 inline-flex items-center justify-center">
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


