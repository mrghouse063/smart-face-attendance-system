import React, { useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Video,
} from 'lucide-react';

export type ViewportVisualState =
  | 'IDLE'
  | 'ACTIVATING'
  | 'LIVE_WAITING_FACE'
  | 'LIVE_VERIFYING'
  | 'MATCH_SUCCESS'
  | 'MATCH_FAILED'
  | 'CAMERA_ERROR';

interface CameraViewportProps {
  visualState: ViewportVisualState;
  stream: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  statusText: string;
  errorTitle?: string;
  errorDetail?: string;
  onRetry?: () => void;
  isStaticDesignPreview?: boolean;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  visualState,
  stream,
  videoRef: externalVideoRef,
  statusText,
  errorTitle = 'Unable to access the camera.',
  errorDetail,
  onRetry,
  isStaticDesignPreview = false,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const targetVideoRef = externalVideoRef || internalVideoRef;

  useEffect(() => {
    const videoEl = targetVideoRef.current;
    if (!videoEl) return;
    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {
        // Autoplay handled via muted + playsInline
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, targetVideoRef, visualState]);

  const guideBorderClass = {
    IDLE: 'border-2 border-dashed border-white/25',
    ACTIVATING: 'border-2 border-white/35',
    LIVE_WAITING_FACE: 'border-2 border-white/80 animate-reticle-pulse',
    LIVE_VERIFYING:
      'border-[3px] border-[#16A34A] shadow-[0_0_0_4px_rgba(22,163,74,0.24)]',
    MATCH_SUCCESS:
      'border-[3px] border-[#16A34A] shadow-[0_0_0_6px_rgba(22,163,74,0.3)]',
    MATCH_FAILED: 'border-[3px] border-[#DC2626] animate-micro-shake',
    CAMERA_ERROR: 'border-2 border-[#DC2626]/50',
  }[visualState];

  return (
    <div className="relative w-full max-w-[380px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-[#111827] border border-[#CBD5E1] select-none shadow-sm">
      {/* 1. Camera / Service Error Screen */}
      {visualState === 'CAMERA_ERROR' ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#111827] text-white">
          <div className="w-14 h-14 rounded-full bg-[#DC2626]/20 text-[#FCA5A5] flex items-center justify-center mb-4">
            <CameraOff className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">{errorTitle}</h3>
          <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed max-w-[270px]">
            {errorDetail ||
              'Camera permission was denied or no camera device is available. Allow camera access in your browser settings and try again.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 min-h-[46px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Retry Camera
            </button>
          )}
        </div>
      ) : visualState === 'IDLE' ? (
        /* 2. Initial Standby Screen (Camera Off — No Fake Face) */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#111827] text-white relative">
          <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
            <div className="w-full h-full max-w-[224px] max-h-[300px] rounded-[999px] border-2 border-dashed border-white/20" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-white/10 text-white/85 flex items-center justify-center mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-white">Camera Standby</p>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-[230px]">
              {statusText}
            </p>
          </div>
        </div>
      ) : visualState === 'ACTIVATING' ? (
        /* 3. Camera Activation & Model Initialization */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#111827] text-white">
          <Loader2 className="w-9 h-9 text-[#22C55E] animate-spin mb-3" />
          <p className="text-sm font-semibold text-white">Starting Camera...</p>
          <p className="text-xs text-[#CBD5E1] mt-1.5 max-w-[240px]">
            {statusText}
          </p>
        </div>
      ) : (
        /* 4. Live Hardware Video Stream (or Honest Static Layout Box in Design Preview) */
        <>
          {stream ? (
            <video
              ref={targetVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full bg-[#1E293B] flex items-center justify-center p-6 text-center">
              <p className="text-xs text-[#94A3B8] max-w-[200px]">
                {isStaticDesignPreview
                  ? 'UI Layout Preview Area (No live camera stream active)'
                  : 'Camera stream closed'}
              </p>
            </div>
          )}

          {/* Top Scrim: Honest Camera Feed Status */}
          <div className="absolute inset-x-0 top-0 p-3.5 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-xs text-[11px] font-medium text-white">
              <Video
                className={`w-3.5 h-3.5 ${
                  stream ? 'text-[#22C55E]' : 'text-[#F59E0B]'
                }`}
              />
              <span>
                {stream
                  ? 'Live Camera Active'
                  : isStaticDesignPreview
                    ? 'Static UI Preview'
                    : 'Camera Closed'}
              </span>
            </div>
          </div>

          {/* Centered Oval Face-Positioning Frame */}
          <div className="absolute inset-0 flex items-center justify-center p-9 pointer-events-none">
            <div
              className={`relative w-full h-full max-w-[232px] max-h-[310px] rounded-[999px] transition-colors duration-150 overflow-hidden ${guideBorderClass}`}
            >
              {visualState === 'LIVE_VERIFYING' && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#22C55E] to-transparent shadow-[0_0_16px_2px_rgba(34,197,94,0.9)] animate-scan-beam" />
              )}

              {visualState === 'MATCH_SUCCESS' && (
                <div className="absolute inset-0 bg-[#16A34A]/20 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                </div>
              )}

              {visualState === 'MATCH_FAILED' && (
                <div className="absolute inset-0 bg-[#DC2626]/20 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#DC2626] text-white flex items-center justify-center shadow-lg">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Scrim & Live Status Text */}
          <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent text-center">
            <div className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-white">
              {visualState === 'LIVE_VERIFYING' && (
                <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin shrink-0" />
              )}
              <span>{statusText}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
