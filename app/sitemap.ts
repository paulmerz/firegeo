import type { MetadataRoute } from 'next';

const appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxum.maj.digital';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/plans', '/brand-monitor', '/docs', '/pricing-public', '/privacy', '/terms'];
  const locales = ['en', 'fr'];

  const sitemap: MetadataRoute.Sitemap = [];

  // Add routes for each locale
  locales.forEach((locale) => {
    routes.forEach((route) => {
      sitemap.push({
        url: `${appUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
        alternates: {
          languages: {
            en: `${appUrl}/en${route}`,
            fr: `${appUrl}/fr${route}`,
          },
        },
      });
    });
  });

  // Add llms.txt for GEO
  sitemap.push({
    url: `${appUrl}/llms.txt`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.9,
  });

  return sitemap;
}

