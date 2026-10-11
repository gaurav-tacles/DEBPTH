import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500/90 text-slate-950 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm border border-amber-400">
      <WifiOff className="w-4 h-4 shrink-0 text-slate-950" />
      <span>Offline Mode — Changes cached locally until reconnected</span>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping ml-1" />
    </div>
  );
};
