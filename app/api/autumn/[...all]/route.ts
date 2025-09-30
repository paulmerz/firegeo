import { autumnHandler } from "autumn-js/next";
import { auth } from "@/lib/auth";
import { isNetworkError, createNetworkError } from "@/lib/network-utils";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Wrap the autumn handler to catch and handle network errors
const originalHandler = autumnHandler({
  identify: async (request) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        logger.info('[Autumn] No session - anonymous user');
        return null;
      }

      // Return the customer information for Autumn
      logger.debug('[Autumn] Identified user:', session.user.id);
      return {
        customerId: session.user.id,
        customerData: {
          name: session.user.name,
          email: session.user.email,
        },
      };
    } catch (error) {
      logger.error('[Autumn] Error in identify:', error);
      return null;
    }
  }
});

type AutumnApiHandler = (request: Request) => Promise<NextResponse>;

// Enhanced error handling wrapper for Autumn routes
async function handleAutumnRequest(handler: AutumnApiHandler, request: Request) {
  try {
    return await handler(request);
  } catch (error) {
    logger.error('[Autumn] Request failed:', error);
    
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