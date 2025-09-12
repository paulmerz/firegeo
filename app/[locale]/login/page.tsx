'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import Image from 'next/image';
import { signIn } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setSuccess(t('auth.passwordResetSuccess'));
    }
    
    // Pre-fill email if passed from registration page
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await signIn.email({
        email,
        password,
      });
      
      if (response.error) {
        setError(response.error.message || t('auth.failedToLogin'));
        setLoading(false);
        return;
      }
      
      // Navigation après connexion (respecte la locale)
      const returnUrl = searchParams.get('from') || '/dashboard';
      router.push(returnUrl || '/dashboard');
    } catch (err: any) {
      setError(err.message || t('auth.failedToLogin'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Orange gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400/90 via-orange-500/90 to-orange-600/90" />
        <div className="relative z-10 max-w-md text-white">
          <h1 className="text-4xl font-bold mb-4">{t('auth.welcomeBack')}</h1>
          <p className="text-lg opacity-90">
            {t('auth.welcomeBackDescription')}
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" />
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000" />
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="lg:hidden mb-8 flex justify-center">
              <Image
                src="/logo_voxum.svg"
                alt="VOXUM"
                width={180}
                height={37}
                priority
              />
            </div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              {t('auth.loginTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {t('auth.or')}{' '}
              <Link href={`/register`} className="font-medium text-orange-600 hover:text-orange-500">
                {t('auth.createNewAccount')}
              </Link>
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  {t('auth.rememberMe')}
                </label>
              </div>
              <Link href={`/forgot-password`} className="text-sm text-orange-600 hover:text-orange-500">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-firecrawl-default w-full inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 h-10 px-4"
              >
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}