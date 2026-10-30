import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#111827] border border-[#334155] px-3.5 py-2 text-xs font-semibold text-white shadow-md"
    >
      <WifiOff className="w-4 h-4 text-[#F59E0B] shrink-0" />
      <span>Offline — Reconnect to verify and record live attendance.</span>
    </div>
  );
};
