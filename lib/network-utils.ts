/**
 * Network utilities for detecting and handling internet connection issues
 */

export interface NetworkError extends Error {
  isNetworkError: boolean;
  isOffline?: boolean;
}

/**
 * Check if an error is related to network connectivity
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  // Check for common network error patterns
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // Common network error patterns
  const networkErrorPatterns = [
    'fetch failed',
    'network error',
    'failed to fetch',
    'network request failed',
    'connection failed',
    'connection refused',
    'timeout',
    'network timeout',
    'offline',
    'no internet',
    'connection lost',
    'internet connection',
    'unable to connect',
    'dns resolution failed',
    'network unreachable',
    'connection reset',
    'connection aborted'
  ];
  
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Check if the browser is currently online
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if we can't detect
}

/**
 * Create a network error with appropriate metadata
 */
export function createNetworkError(originalError: unknown, message?: string): NetworkError {
  const error = new Error(message || 'Network connection error') as NetworkError;
  error.isNetworkError = true;
  error.isOffline = !isOnline();
  error.cause = originalError;
  return error;
}

/**
 * Enhanced fetch with network error detection
 */
export async function fetchWithNetworkErrorHandling(
  url: string | URL | Request, 
  options?: RequestInit
): Promise<Response> {
  try {
    // Check if browser is offline before attempting fetch
    if (!isOnline()) {
      throw createNetworkError(null, 'You are not connected to the internet');
    }
    
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Check if this is a network-related error
    if (isNetworkError(error)) {
      throw createNetworkError(error, 'Connection lost. Please check your internet connection and try again.');
    }
    
    // Re-throw non-network errors as-is
    throw error;
  }
}

/**
 * Check if the browser is currently online (synchronous check)
 */
export function checkOnlineStatus(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if we can't detect
}
