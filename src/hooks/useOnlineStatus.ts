import { useEffect, useState } from 'react';
import { logger } from '../lib/logger';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('NetworkStatus', 'Device came back online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('NetworkStatus', 'Device went offline. Falling back to local cache.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
