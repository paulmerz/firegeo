import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
import { NetworkStatusAlert } from "@/components/ui/network-status-alert";
import { routing } from '@/i18n/routing';

const appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? "https://voxum.maj.digital";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const localizedUrl = `${appUrl}/${locale}`;
  const t = await getTranslations({ locale, namespace: 'seo.common' });
  const title = t('title');
  const description = t('description');
  const siteName = t('siteName');
  const ogAlt = t('ogAlt');

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      url: localizedUrl,
      siteName,
      title,
      description,
      images: [
        {
          url: '/og/default-og.jpg',
          width: 1200,
          height: 630,
          alt: ogAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og/twitter-card.jpg'],
    },
    alternates: {
      canonical: localizedUrl,
      languages: {
        en: `${appUrl}/en`,
        fr: `${appUrl}/fr`,
      },
    },
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = await params;
  
  // Valider que la locale est supportée
  if (!routing.locales.some(l => l === locale)) {
    notFound();
  }

  // Fournir tous les messages à la page et aux composants enfants
  const messages = await getMessages({ locale });

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang = '${locale}';`,
        }}
      />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            <NetworkStatusAlert />
          </div>
        </Providers>
      </NextIntlClientProvider>
    </>
  );
}
