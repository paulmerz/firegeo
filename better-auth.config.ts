import { betterAuth } from 'better-auth';
import { localization } from 'better-auth-localization';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables for CLI
dotenv.config({ path: '.env.local' });

const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS || 'http://localhost:3000',
};

export const auth = betterAuth({
  database: new Pool({
    connectionString: env.DATABASE_URL,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.NODE_ENV === 'production',
  },
  emailVerification: {
    sendOnSignUp: env.NODE_ENV === 'production',
    autoSignInAfterVerification: true,
  },
  trustedOrigins: env.TRUSTED_ORIGINS.split(',').map(origin => origin.trim()),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session if older than 1 day
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === 'production',
    },
  },
  plugins: [
    localization({
      defaultLocale: 'default',
      fallbackLocale: 'default',
      getLocale: (request) => {
        try {
          if (!request) return 'default';
          const headerPath = request.headers.get('x-pathname') || request.headers.get('referer') || '';
          if (/\/(fr)(\/|$)/i.test(headerPath)) return 'fr-FR';
          const lang = request.headers.get('accept-language') || '';
          if (/fr/i.test(lang)) return 'fr-FR';
          return 'default';
        } catch {
          return 'default';
        }
      }
    })
  ]
});
