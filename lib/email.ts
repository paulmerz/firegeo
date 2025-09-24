import { Resend } from 'resend';
import React from 'react';

// Initialize Resend - you'll need to add RESEND_API_KEY to your .env.local
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const sendEmail = async ({ 
  to, 
  subject, 
  text, 
  html 
}: { 
  to: string; 
  subject: string; 
  text?: string; 
  html?: string; 
}) => {
  // In development without API key, just log to console
  if (!process.env.RESEND_API_KEY || !resend) {
    console.log('📧 Email would be sent:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Content:', html || text);
    console.log('\n⚠️  Add RESEND_API_KEY to .env.local to send real emails');
    return { id: 'dev-email' };
  }

  try {
    const { data: sendData, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SaaS Starter <onboarding@resend.dev>',
      to,
      subject,
      // Resend v3+ attend un contenu React. On encapsule HTML/texte.
      react: React.createElement('div', {
        dangerouslySetInnerHTML: {
          __html: (html ?? (text ? `<pre>${text}</pre>` : '')) as string,
        },
      }),
    });
    if (error) {
      throw error;
    }
    console.log('Email sent:', sendData?.id);
    return { id: sendData?.id ?? 'unknown' };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};