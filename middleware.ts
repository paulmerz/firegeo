import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Define protected routes (sans locale)
const protectedRoutes = ['/dashboard', '/chat', '/brand-monitor'];

// Créer le middleware d'internationalisation - laissons-le gérer tout
const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = process.env.TRUSTED_ORIGINS?.split(',').map(o => o.trim()) || [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      const response = NextResponse.next();
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
      
      console.log('✅ CORS headers set for origin:', origin);
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        console.log('🔄 Handling preflight request');
        return new Response(null, { status: 200, headers: response.headers });
      }
      
      return response;
    } else {
      console.log('❌ CORS blocked for origin:', origin);
    }
  }
  
  // Si c'est la route racine, laisser next-intl gérer la redirection
  if (pathname === '/') {
    const sessionCookie = await getSessionCookie(request);
    if (sessionCookie) {
      // Détecter la locale: priorité au cookie NEXT_LOCALE, puis Accept-Language, sinon defaultLocale
      const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
      const acceptLanguage = request.headers.get('accept-language') || '';
      const preferredLang = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();

      let locale: string | undefined = undefined;
      if (localeCookie && (routing.locales as readonly string[]).includes(localeCookie)) {
        locale = localeCookie;
      } else if (preferredLang && (routing.locales as readonly string[]).includes(preferredLang)) {
        locale = preferredLang;
      } else {
        locale = routing.defaultLocale as string;
      }

      const url = new URL(`/${locale}/brand-monitor`, request.url);
      return NextResponse.redirect(url);
    }
    // Sinon, laisser next-intl faire la détection de locale
    return intlMiddleware(request);
  }
  
  // Pour toutes les autres routes, d'abord appliquer l'internationalisation
  const intlResponse = intlMiddleware(request);
  
  // Si next-intl veut rediriger, on le fait
  if (intlResponse) {
    return intlResponse;
  }
  
  // Maintenant traiter l'authentification pour les routes avec locale
  const segments = pathname.split('/');
  const locale = segments[1];
  
  // Vérifier que nous avons une locale valide
  if (!routing.locales.includes(locale as any)) {
    return NextResponse.next();
  }
  
  const pathnameWithoutLocale = pathname.replace(`/${locale}`, '') || '/';

  // Si on est sur la racine localisée (ex: /fr) et que l'utilisateur est connecté, rediriger vers /{locale}/brand-monitor
  if (pathnameWithoutLocale === '/' ) {
    const sessionCookie = await getSessionCookie(request);
    if (sessionCookie) {
      const url = new URL(`/${locale}/brand-monitor`, request.url);
      return NextResponse.redirect(url);
    }
  }
  
  // Vérifier si la route est protégée
  const isProtectedRoute = protectedRoutes.some(route => 
    pathnameWithoutLocale.startsWith(route)
  );

  if (isProtectedRoute) {
    // Vérifier le cookie de session
    const sessionCookie = await getSessionCookie(request);
    
    if (!sessionCookie) {
      // Rediriger vers login en gardant la locale
      const url = new URL(`/${locale}/login`, request.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Créer une réponse avec les headers de sécurité
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  return response;
}

export const config = {
  matcher: [
    // Inclure explicitement la route racine pour la redirection
    '/',
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)  
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).)',
  ],
};
