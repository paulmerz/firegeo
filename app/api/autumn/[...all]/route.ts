import { autumnHandler } from "autumn-js/next";
import { auth } from "@/lib/auth";
import { isNetworkError, createNetworkError } from "@/lib/network-utils";
import { NextResponse } from "next/server";

// Wrap the autumn handler to catch and handle network errors
const originalHandler = autumnHandler({
  identify: async (request) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        console.log('[Autumn] No session - anonymous user');
        return null;
      }

      // Return the customer information for Autumn
      console.log('[Autumn] Identified user:', session.user.id);
      return {
        customerId: session.user.id,
        customerData: {
          name: session.user.name,
          email: session.user.email,
        },
      };
    } catch (error) {
      console.error('[Autumn] Error in identify:', error);
      return null;
    }
  },
  billingPortalConfig: {
    business_name: "Fire SaaS",
    privacy_policy_url: `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,
    terms_of_service_url: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
  },
});

// Enhanced error handling wrapper for Autumn routes
async function handleAutumnRequest(handler: Function, request: Request) {
  try {
    return await handler(request);
  } catch (error) {
    console.error('[Autumn] Request failed:', error);
    
    // Check if this is a network error
    if (isNetworkError(error)) {
      const networkError = createNetworkError(error);
      
      return NextResponse.json({
        error: {
          message: networkError.isOffline 
            ? 'You are not connected to the internet'
            : 'Connection lost. Please check your internet connection and try again.',
          code: 'NETWORK_ERROR',
          isNetworkError: true,
          isOffline: networkError.isOffline
        }
      }, { status: 503 });
    }
    
    // Re-throw non-network errors to let Autumn handle them
    throw error;
  }
}

// Export wrapped handlers
export async function GET(request: Request) {
  return handleAutumnRequest(originalHandler.GET, request);
}

export async function POST(request: Request) {
  return handleAutumnRequest(originalHandler.POST, request);
}