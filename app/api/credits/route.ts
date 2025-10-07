import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Autumn } from 'autumn-js';
import { AuthenticationError, ExternalServiceError, handleApiError } from '@/lib/api-errors';
import { FEATURE_ID_CREDITS } from '@/config/constants';

function getAutumn() {
  const secret = process.env.AUTUMN_SECRET_KEY;
  if (!secret) {
    throw new Error('Autumn secret key or publishable key is required');
  }
  return new Autumn({ secretKey: secret });
}

// Simple in-memory dedupe to avoid accidental multiple debits on fast re-renders
// Key: `${userId}:${reason}` → timestamp
const lastDebitByReason = new Map<string, number>();
const DEDUPE_WINDOWS_MS: Record<string, number> = {
  // plus de débit au rendu
};

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view your credits');
    }

    // Check feature access for credits
    const access = await getAutumn().check({
      customer_id: sessionResponse.user.id,
      feature_id: FEATURE_ID_CREDITS,
    });

    return NextResponse.json({
      allowed: access.data?.allowed || false,
      balance: access.data?.balance || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to manage credits');
    }

    const { value, reason } = await request.json();
    console.log('🔍 [Credits API POST] User:', sessionResponse.user.id, 'Value:', value, 'Reason:', reason);
    
    if (!value || typeof value !== 'number' || value <= 0) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
    }

    // Dedupe for specific reasons
    if (reason && typeof reason === 'string') {
      const windowMs = DEDUPE_WINDOWS_MS[reason];
      if (windowMs) {
        const key = `${sessionResponse.user.id}:${reason}`;
        const now = Date.now();
        const last = lastDebitByReason.get(key) || 0;
        if (now - last < windowMs) {
          // Treat as success with no additional debit
          const access = await getAutumn().check({
            customer_id: sessionResponse.user.id,
            feature_id: FEATURE_ID_CREDITS,
          });
          return NextResponse.json({ success: true, balance: access.data?.balance || 0, deduped: true });
        }
        lastDebitByReason.set(key, now);
      }
    }

    // Check balance before debit
    const access = await getAutumn().check({
      customer_id: sessionResponse.user.id,
      feature_id: FEATURE_ID_CREDITS,
    });

    if (!access.data?.allowed || (access.data?.balance ?? 0) < value) {
      throw new ExternalServiceError('Insufficient credits', 'autumn');
    }

    // Track usage
    console.log('🔍 [Credits API POST] Tracking usage...');
    await getAutumn().track({
      customer_id: sessionResponse.user.id,
      feature_id: FEATURE_ID_CREDITS,
      value: value,
    });

    // Return new balance
    console.log('🔍 [Credits API POST] Getting updated balance...');
    const updated = await getAutumn().check({
      customer_id: sessionResponse.user.id,
      feature_id: FEATURE_ID_CREDITS,
    });

    console.log('🔍 [Credits API POST] Updated balance:', updated.data?.balance);

    return NextResponse.json({ success: true, balance: updated.data?.balance || 0 });
  } catch (error) {
    return handleApiError(error);
  }
}