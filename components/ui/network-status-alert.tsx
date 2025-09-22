'use client';

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface NetworkStatusAlertProps {
  className?: string;
}

export function NetworkStatusAlert({ className }: NetworkStatusAlertProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const t = useTranslations('errors');

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      // Show briefly that connection is restored
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show alert when offline or briefly when coming back online
  if (!showAlert && isOnline) return null;

  return (
    <Alert 
      className={`fixed top-4 right-4 z-50 max-w-md transition-all duration-300 ${
        isOnline 
          ? 'border-green-200 bg-green-50 text-green-800' 
          : 'border-orange-200 bg-orange-50 text-orange-800'
      } ${className || ''}`}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <AlertDescription>
        {isOnline ? (
          'Connexion rétablie'
        ) : (
          t('noInternetConnection')
        )}
      </AlertDescription>
    </Alert>
  );
}

// Hook to use network status in components
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline
  };
}
