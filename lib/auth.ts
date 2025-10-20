import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { sendEmail } from './email';
import { autumn } from 'autumn-js/better-auth';
import { localization } from 'better-auth-localization';

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL!,
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    sendResetPassword: async ({ user, url }) => {
      console.log('Password reset link:', url);
      
      await sendEmail({
        to: user.email,
        subject: 'Reset your password - Voxum',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p style="color: #666; line-height: 1.6;">
              You requested to reset your password. Click the button below to create a new password.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 14px;">
              If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #999; font-size: 14px;">
              This link will expire in 1 hour.
            </p>
          </div>
        `
      });
    },
  },
  trustedOrigins: (process.env.TRUSTED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    .split(',').map(origin => origin.trim()),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    freshAge: 60 * 60 * 24,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  },
  emailVerification: {
    sendOnSignUp: process.env.NODE_ENV === 'production',
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log('Verification link:', url);
      
      await sendEmail({
        to: user.email,
        subject: 'Verify your email - Voxum',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verify Your Email Address</h2>
            <p style="color: #666; line-height: 1.6;">
              Thanks for signing up! Please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #999; font-size: 14px;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        `
      });
    },
  },
  plugins: [
    autumn(),
    localization({
      defaultLocale: 'default',
      fallbackLocale: 'default',
      getLocale: async (request) => {
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
  ],
});