import React, { useState } from 'react';
import { Check, Copy, Download, Monitor, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback if clipboard blocked
    }
  };

  const buttonClasses =
    variant === 'sidebar'
      ? 'w-full min-h-[44px] px-3.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap'
      : 'min-h-[40px] px-3.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-xs font-semibold text-[#166534] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={buttonClasses}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-app-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-lg text-[#111827] space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="install-app-title"
                  className="text-lg font-bold text-[#111827]"
                >
                  Install Smart Attendance App
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Use Smart Attendance as a full-screen app on your phone, tablet, or desktop kiosk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="min-w-[36px] min-h-[36px] rounded-lg text-[#64748B] hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <p className="text-xs font-semibold text-[#111827]">
                  Step 1: Open Direct App Link in Browser
                </p>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Browsers require opening the direct link in a regular tab (Chrome, Edge, or Safari) to install onto your device:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={appUrl}
                    aria-label="Direct application URL"
                    className="flex-1 h-9 px-2.5 rounded-lg bg-white border border-[#CBD5E1] font-mono text-[11px] text-[#111827] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="h-9 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs text-[#475569]">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                <Smartphone className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#111827]">
                    {isIOS ? 'iPhone / iPad (Safari)' : 'Android & Mobile'}
                  </p>
                  {isIOS ? (
                    <p className="mt-0.5 leading-relaxed">
                      Tap the <strong>Share</strong> icon in Safari, then tap{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  ) : (
                    <p className="mt-0.5 leading-relaxed">
                      In Chrome, tap the <strong>⋮ Menu</strong> and select{' '}
                      <strong>Install app</strong> (or <strong>Add to Home screen</strong>). On iPhone Safari, tap <strong>Share &rarr; Add to Home Screen</strong>.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                <Monitor className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#111827]">
                    Windows / Mac Desktop Kiosk
                  </p>
                  <p className="mt-0.5 leading-relaxed">
                    Open the app URL in Chrome or Edge and click the{' '}
                    <strong>Install</strong> icon on the right side of the address bar.
                  </p>
                </div>
              </div>
            </div>

            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
