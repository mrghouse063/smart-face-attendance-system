import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  X,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import {
  averageFaceDescriptors,
  detectLiveFace,
  ensureFaceRecognitionModels,
  extractFaceDescriptorFromVideo,
  requestUserCameraStream,
  stopMediaStream,
} from '../../services/faceRecognitionEngine';
import {
  AttendanceConfirmationPayload,
  ScannerWorkflowStage,
  VerifiedEmployeePayload,
} from '../../types/attendance';
import { CameraViewport, ViewportVisualState } from '../CameraViewport';
import { EmployeeAvatar } from '../EmployeeAvatar';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  formatRealDate,
  formatRealReadableDate,
  formatRealTime,
} from '../../utils/dateTime';

interface EmployeeAttendanceInterfaceProps {
  onNavigateAdminLogin: () => void;
}

const AUTO_RETURN_SECONDS = 10;

type StaticPreviewStage =
  | null
  | 'CAMERA_ACTIVATION'
  | 'WAITING_FOR_FACE'
  | 'VERIFYING_IDENTITY'
  | 'VERIFIED_IDENTITY'
  | 'FACE_NOT_RECOGNIZED'
  | 'CAMERA_ERROR';

export const EmployeeAttendanceInterface: React.FC<
  EmployeeAttendanceInterfaceProps
> = ({ onNavigateAdminLogin }) => {
  const [stage, setStage] = useState<ScannerWorkflowStage>(
    ScannerWorkflowStage.IDLE
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [failedDetail, setFailedDetail] = useState<string>(
    'Your face does not match any registered employee.'
  );

  // Strictly isolated employee identity obtained ONLY from genuine server recognition
  const [verifiedData, setVerifiedData] =
    useState<VerifiedEmployeePayload | null>(null);
  const [confirmationData, setConfirmationData] =
    useState<AttendanceConfirmationPayload | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState<boolean>(false);
  const [autoResetSecondsLeft, setAutoResetSecondsLeft] =
    useState<number>(AUTO_RETURN_SECONDS);

  // Non-functional UI Design Preview Inspector (clearly labeled, never fakes recognition)
  const [showStateInspector, setShowStateInspector] = useState<boolean>(false);
  const [staticPreviewStage, setStaticPreviewStage] =
    useState<StaticPreviewStage>(null);

  // Real-time clock & date for the employee attendance terminal
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const clockInterval = window.setInterval(() => {
      setLiveNow(new Date());
    }, 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const formattedLiveTime = formatRealTime(liveNow);
  const formattedLiveDate = formatRealReadableDate(liveNow);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionActiveRef = useRef<boolean>(false);

  const stopCameraCleanly = useCallback(() => {
    detectionActiveRef.current = false;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  // Privacy-mandatory reset: stops camera and wipes all employee identity data
  const resetToInitialScanner = useCallback(() => {
    stopCameraCleanly();
    setStaticPreviewStage(null);
    setVerifiedData(null);
    setConfirmationData(null);
    setPunchError(null);
    setIsSubmittingPunch(false);
    setErrorMessage('');
    setFailedDetail('Your face does not match any registered employee.');
    setStage(ScannerWorkflowStage.IDLE);
    setAutoResetSecondsLeft(AUTO_RETURN_SECONDS);
  }, [stopCameraCleanly]);

  useEffect(() => {
    return () => {
      stopCameraCleanly();
    };
  }, [stopCameraCleanly]);

  // Auto-return timer on Check-In / Check-Out Confirmation screens
  useEffect(() => {
    if (
      stage !== ScannerWorkflowStage.CHECK_IN_SUCCESS &&
      stage !== ScannerWorkflowStage.CHECK_OUT_SUCCESS
    ) {
      return;
    }

    setAutoResetSecondsLeft(AUTO_RETURN_SECONDS);
    const interval = window.setInterval(() => {
      setAutoResetSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          resetToInitialScanner();
          return AUTO_RETURN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [stage, resetToInitialScanner]);

  // Step 2 & 3: Start Face Scan -> Request Camera -> Detect Real Face -> Verify Descriptor
  const handleStartFaceScan = async () => {
    setStaticPreviewStage(null);
    setVerifiedData(null);
    setConfirmationData(null);
    setPunchError(null);
    setErrorMessage('');
    setStage(ScannerWorkflowStage.CAMERA_ACTIVATION);

    try {
      // Load local neural models & request hardware camera access
      const [mediaStream] = await Promise.all([
        requestUserCameraStream(),
        ensureFaceRecognitionModels(),
      ]);

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStage(ScannerWorkflowStage.WAITING_FOR_FACE);
      detectionActiveRef.current = true;

      // Start continuous real-face detection loop on live video frames
      runLiveFaceDetectionAndVerificationLoop();
    } catch (err) {
      stopCameraCleanly();
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to start camera or load facial recognition models.'
      );
      setStage(ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR);
    }
  };

  const runLiveFaceDetectionAndVerificationLoop = async () => {
    let consecutiveDetections = 0;

    while (detectionActiveRef.current) {
      const videoEl = videoRef.current;
      if (videoEl && videoEl.readyState >= 2) {
        try {
          const check = await detectLiveFace(videoEl);
          if (!detectionActiveRef.current) return;

          if (check.detected) {
            consecutiveDetections += 1;
          } else {
            consecutiveDetections = 0;
          }

          // Require 3 consecutive real face frames before entering verification
          if (consecutiveDetections >= 3) {
            setStage(ScannerWorkflowStage.VERIFYING_IDENTITY);

            // Capture 3 real 128-D descriptors from consecutive frames for reliable matching
            const collectedDescriptors: number[][] = [];
            let missedFrames = 0;

            while (
              detectionActiveRef.current &&
              collectedDescriptors.length < 3 &&
              missedFrames < 6
            ) {
              const sample = await extractFaceDescriptorFromVideo(videoEl);
              if (!detectionActiveRef.current) return;

              if (sample) {
                collectedDescriptors.push(sample.descriptor);
              } else {
                missedFrames += 1;
              }
              await new Promise((r) => window.setTimeout(r, 150));
            }

            if (!detectionActiveRef.current) return;

            // If user moved out of frame before descriptor extraction finished, wait for face again
            if (collectedDescriptors.length < 2) {
              consecutiveDetections = 0;
              setStage(ScannerWorkflowStage.WAITING_FOR_FACE);
              continue;
            }

            const averagedDescriptor =
              averageFaceDescriptors(collectedDescriptors);

            // Stop camera once descriptor is captured and verify against backend templates
            stopCameraCleanly();

            try {
              const matchResponse =
                await attendanceApi.recognizeFace(averagedDescriptor);
              setVerifiedData(matchResponse);
              setStage(ScannerWorkflowStage.VERIFIED_IDENTITY);
              return;
            } catch (apiErr) {
              const typedErr = apiErr as Error & {
                code?: string;
                detail?: string;
                status?: number;
              };
              if (
                typedErr.code === 'FACE_NOT_MATCHED' ||
                typedErr.code === 'EMPLOYEE_INACTIVE' ||
                typedErr.status === 404 ||
                typedErr.status === 403
              ) {
                setFailedDetail(
                  typedErr.detail ||
                    'Your face does not match any registered employee.'
                );
                setStage(ScannerWorkflowStage.FACE_NOT_RECOGNIZED);
              } else {
                setErrorMessage(
                  typedErr.detail ||
                    typedErr.message ||
                    'Recognition service is currently unavailable.'
                );
                setStage(ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR);
              }
              return;
            }
          }
        } catch (loopErr) {
          stopCameraCleanly();
          setErrorMessage(
            loopErr instanceof Error
              ? loopErr.message
              : 'An error occurred during facial analysis.'
          );
          setStage(ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR);
          return;
        }
      }

      await new Promise((r) => window.setTimeout(r, 220));
    }
  };

  const handleSelectAttendanceAction = async (action: 'IN' | 'OUT') => {
    if (!verifiedData || isSubmittingPunch) return;

    setIsSubmittingPunch(true);
    setPunchError(null);

    try {
      const confirmation = await attendanceApi.recordPunch({
        verificationToken: verifiedData.verificationToken,
        action,
      });

      setConfirmationData(confirmation);
      setVerifiedData(null);
      setStage(
        action === 'IN'
          ? ScannerWorkflowStage.CHECK_IN_SUCCESS
          : ScannerWorkflowStage.CHECK_OUT_SUCCESS
      );
    } catch (err) {
      setPunchError((err as Error).message || 'Unable to record attendance.');
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  const handleActivateStaticPreview = (preview: StaticPreviewStage) => {
    stopCameraCleanly();
    setVerifiedData(null);
    setConfirmationData(null);
    setStaticPreviewStage(preview);
    if (!preview) {
      setStage(ScannerWorkflowStage.IDLE);
    }
  };

  // Resolve visual state for CameraViewport (either genuine workflow or clearly-marked static UI preview)
  const getViewportVisualState = (): ViewportVisualState => {
    if (staticPreviewStage) {
      switch (staticPreviewStage) {
        case 'CAMERA_ACTIVATION':
          return 'ACTIVATING';
        case 'WAITING_FOR_FACE':
          return 'LIVE_WAITING_FACE';
        case 'VERIFYING_IDENTITY':
          return 'LIVE_VERIFYING';
        case 'FACE_NOT_RECOGNIZED':
          return 'MATCH_FAILED';
        case 'CAMERA_ERROR':
          return 'CAMERA_ERROR';
        default:
          return 'IDLE';
      }
    }

    switch (stage) {
      case ScannerWorkflowStage.CAMERA_ACTIVATION:
        return 'ACTIVATING';
      case ScannerWorkflowStage.WAITING_FOR_FACE:
        return 'LIVE_WAITING_FACE';
      case ScannerWorkflowStage.VERIFYING_IDENTITY:
        return 'LIVE_VERIFYING';
      case ScannerWorkflowStage.FACE_NOT_RECOGNIZED:
        return 'MATCH_FAILED';
      case ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR:
        return 'CAMERA_ERROR';
      case ScannerWorkflowStage.IDLE:
      default:
        return 'IDLE';
    }
  };

  const getViewportStatusText = (): string => {
    if (staticPreviewStage) {
      switch (staticPreviewStage) {
        case 'CAMERA_ACTIVATION':
          return 'Requesting camera permission & loading recognition model...';
        case 'WAITING_FOR_FACE':
          return 'Camera active. Position your face inside the frame.';
        case 'VERIFYING_IDENTITY':
          return 'Face detected. Verifying identity...';
        case 'FACE_NOT_RECOGNIZED':
          return 'Face Not Recognized';
        case 'CAMERA_ERROR':
          return 'Camera or recognition unavailable';
        default:
          return 'Click "Start Face Scan" to open camera';
      }
    }

    switch (stage) {
      case ScannerWorkflowStage.IDLE:
        return 'Click "Start Face Scan" to open the live camera.';
      case ScannerWorkflowStage.CAMERA_ACTIVATION:
        return 'Requesting access to device camera...';
      case ScannerWorkflowStage.WAITING_FOR_FACE:
        return 'Position your face inside the frame.';
      case ScannerWorkflowStage.VERIFYING_IDENTITY:
        return 'Face detected. Verifying identity...';
      case ScannerWorkflowStage.FACE_NOT_RECOGNIZED:
        return 'Face Not Recognized';
      case ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR:
        return 'Camera or recognition error';
      default:
        return '';
    }
  };

  const isConfirmationStage =
    !staticPreviewStage &&
    (stage === ScannerWorkflowStage.CHECK_IN_SUCCESS ||
      stage === ScannerWorkflowStage.CHECK_OUT_SUCCESS);

  const isVerifiedIdentityScreen =
    (!staticPreviewStage &&
      stage === ScannerWorkflowStage.VERIFIED_IDENTITY &&
      verifiedData !== null) ||
    staticPreviewStage === 'VERIFIED_IDENTITY';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#16A34A] text-white flex items-center justify-center">
            <ScanFace className="w-5 h-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#111827] whitespace-nowrap">
            Smart Attendance
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton variant="header" />

          <button
            type="button"
            onClick={() => {
              resetToInitialScanner();
              onNavigateAdminLogin();
            }}
            className="min-h-[40px] px-3 sm:px-3.5 rounded-lg text-xs font-semibold text-[#475569] hover:text-[#111827] hover:bg-[#F1F5F9] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Administrator Login</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        {/* Prominent Honesty Banner whenever UI Design Preview Mode is active */}
        {staticPreviewStage && (
          <div
            role="status"
            className="mb-5 p-4 rounded-2xl bg-[#FFFBEB] border border-[#F59E0B] flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[#92400E]"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <span>
                <strong>STATIC UI DESIGN PREVIEW:</strong> Demonstrating screen layout only — this is <strong>not</strong> performing facial recognition. Exit preview to run a genuine live camera scan.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleActivateStaticPreview(null)}
              className="min-h-[36px] px-3 rounded-lg bg-[#92400E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit Preview</span>
            </button>
          </div>
        )}

        {/* =============================================================== */}
        {/* SCANNER WORKFLOW SCREENS (IDLE, ACTIVATING, DETECTING,          */}
        {/* VERIFYING, FAILED RECOGNITION, CAMERA/SERVICE ERROR)            */}
        {/* =============================================================== */}
        {!isVerifiedIdentityScreen && !isConfirmationStage && (
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-8 shadow-xs">
            {/* Real-Time Terminal Clock & Date Bar */}
            <div
              aria-label="Current local time and date"
              className="pb-5 mb-6 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-center sm:text-left"
            >
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-medium text-[#475569]">
                <CalendarDays className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>{formattedLiveDate}</span>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <Clock className="w-4 h-4 text-[#16A34A] shrink-0" />
                <time
                  dateTime={liveNow.toISOString()}
                  className="font-mono text-2xl sm:text-[26px] font-bold text-[#111827] tracking-tight tabular-nums-strict leading-none"
                >
                  {formattedLiveTime}
                </time>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Camera Preview Area */}
              <div className="lg:col-span-6">
                <CameraViewport
                  visualState={getViewportVisualState()}
                  stream={stream}
                  videoRef={videoRef}
                  statusText={getViewportStatusText()}
                  errorTitle="Camera or Recognition Error"
                  errorDetail={
                    staticPreviewStage === 'CAMERA_ERROR'
                      ? 'Camera access was denied or no camera device is available in this environment.'
                      : errorMessage
                  }
                  onRetry={
                    staticPreviewStage
                      ? undefined
                      : () => handleStartFaceScan()
                  }
                  isStaticDesignPreview={Boolean(staticPreviewStage)}
                />
                <p className="text-xs text-[#64748B] text-center mt-3 max-w-xs mx-auto">
                  Camera opens only after you click &ldquo;Start Face Scan&rdquo; and grant browser camera permission.
                </p>
              </div>

              {/* Right Column: Separate Stage Panels */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <div className="text-center lg:text-left">
                  <span className="text-xs font-semibold text-[#16A34A] tracking-wide uppercase">
                    Biometric Attendance Terminal
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mt-1">
                    Employee Attendance
                  </h1>
                  <p className="text-base text-[#475569] mt-1.5">
                    Scan your face to continue.
                  </p>
                </div>

                {/* STAGE 1: INITIAL IDLE STATE */}
                {!staticPreviewStage && stage === ScannerWorkflowStage.IDLE && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <p className="text-sm font-semibold text-[#111827]">
                        Ready to start live camera scan
                      </p>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                        Click &ldquo;Start Face Scan&rdquo; to open your device camera. Your face will be verified against enrolled employee templates.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartFaceScan}
                      className="w-full min-h-[54px] px-6 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-base flex items-center justify-center gap-2.5 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Start Face Scan</span>
                    </button>
                  </div>
                )}

                {/* STAGE 2: CAMERA ACTIVATION */}
                {(staticPreviewStage === 'CAMERA_ACTIVATION' ||
                  (!staticPreviewStage &&
                    stage === ScannerWorkflowStage.CAMERA_ACTIVATION)) && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-6 p-5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-[#16A34A] animate-spin shrink-0" />
                      <div>
                        <h2 className="text-sm font-bold text-[#111827]">
                          Activating Camera &amp; Recognition Model
                        </h2>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          Please allow browser camera access if prompted.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 3A: LIVE CAMERA OPEN — WAITING FOR ACTUAL FACE */}
                {(staticPreviewStage === 'WAITING_FOR_FACE' ||
                  (!staticPreviewStage &&
                    stage === ScannerWorkflowStage.WAITING_FOR_FACE)) && (
                  <div className="mt-6 space-y-4">
                    <div
                      role="status"
                      aria-live="polite"
                      className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1]"
                    >
                      <p className="text-sm font-bold text-[#111827]">
                        Camera active — waiting for face detection
                      </p>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                        Center your face inside the oval guide under clear lighting. Verification begins automatically once an actual face is detected.
                      </p>
                    </div>

                    {!staticPreviewStage && (
                      <button
                        type="button"
                        onClick={resetToInitialScanner}
                        className="w-full min-h-[46px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
                      >
                        Cancel Scan
                      </button>
                    )}
                  </div>
                )}

                {/* STAGE 3B: FACE DETECTED — VERIFYING IDENTITY */}
                {(staticPreviewStage === 'VERIFYING_IDENTITY' ||
                  (!staticPreviewStage &&
                    stage === ScannerWorkflowStage.VERIFYING_IDENTITY)) && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-6 p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center gap-3.5"
                  >
                    <Loader2 className="w-6 h-6 text-[#16A34A] animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[#166534]">
                        Face detected. Verifying identity...
                      </p>
                      <p className="text-xs text-[#15803D] mt-0.5">
                        Matching facial features against registered employee templates. Hold steady.
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE 5: FAILED RECOGNITION (NO MATCH) */}
                {(staticPreviewStage === 'FACE_NOT_RECOGNIZED' ||
                  (!staticPreviewStage &&
                    stage === ScannerWorkflowStage.FACE_NOT_RECOGNIZED)) && (
                  <div
                    role="alert"
                    className="mt-6 p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-base font-bold text-[#991B1B]">
                          Face Not Recognized
                        </h2>
                        <p className="text-sm text-[#7F1D1D] mt-1 leading-relaxed">
                          {staticPreviewStage
                            ? 'Your face does not match any registered employee.'
                            : failedDetail}
                        </p>
                        <p className="text-xs text-[#991B1B]/80 mt-2">
                          If you are an employee, ask an administrator to enroll your face in the Administrator Panel first.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        staticPreviewStage
                          ? () => handleActivateStaticPreview(null)
                          : handleStartFaceScan
                      }
                      className="w-full min-h-[48px] px-5 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Try Again</span>
                    </button>
                  </div>
                )}

                {/* STAGE 6: CAMERA OR SERVICE ERROR */}
                {(staticPreviewStage === 'CAMERA_ERROR' ||
                  (!staticPreviewStage &&
                    stage === ScannerWorkflowStage.CAMERA_OR_SERVICE_ERROR)) && (
                  <div
                    role="alert"
                    className="mt-6 p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-base font-bold text-[#991B1B]">
                          Camera or Recognition Unavailable
                        </h2>
                        <p className="text-sm text-[#7F1D1D] mt-1 leading-relaxed">
                          {staticPreviewStage
                            ? 'Unable to access the device camera or load the facial recognition model.'
                            : errorMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={
                          staticPreviewStage
                            ? () => handleActivateStaticPreview(null)
                            : handleStartFaceScan
                        }
                        className="flex-1 min-h-[48px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetToInitialScanner}
                        className="min-h-[48px] px-4 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}

                {/* Privacy Footer */}
                <div className="mt-6 pt-5 border-t border-[#F1F5F9] flex items-start gap-2.5 text-xs text-[#64748B]">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <span>
                    No hardcoded identities or simulated scans are used. Attendance actions unlock strictly after live camera facial matching succeeds.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* STAGE 4: SUCCESSFUL RECOGNITION (GENUINE MATCH OR LABELED       */}
        {/* NON-FUNCTIONAL UI LAYOUT PREVIEW)                               */}
        {/* =============================================================== */}
        {isVerifiedIdentityScreen && (
          <div className="max-w-lg mx-auto w-full bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-[#16A34A]">
                Identity Verified
              </p>
              <h1 className="text-2xl font-bold text-[#111827] mt-1">
                Select Attendance Action
              </h1>
              <div className="mt-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#475569]">
                <Clock className="w-4 h-4 text-[#16A34A] shrink-0" />
                <time
                  dateTime={liveNow.toISOString()}
                  className="font-mono font-semibold text-[#111827] tabular-nums-strict"
                >
                  {formattedLiveTime}
                </time>
                <span className="text-[#CBD5E1]" aria-hidden="true">
                  &bull;
                </span>
                <span>{formattedLiveDate}</span>
              </div>
            </div>

            {verifiedData ? (
              <div className="mt-6 p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-4">
                <EmployeeAvatar
                  name={verifiedData.employee.fullName}
                  color={verifiedData.employee.avatarColor}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#64748B]">
                    Employee Name
                  </div>
                  <div className="text-lg font-bold text-[#111827] truncate">
                    {verifiedData.employee.fullName}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-[#64748B]">Employee ID:</span>
                    <span className="font-mono font-bold text-[#111827] tabular-nums-strict">
                      {verifiedData.employee.employeeId}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Static UI Layout Placeholder — NO hardcoded employee name or ID */
              <div className="mt-6 p-5 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1]">
                <div className="text-xs font-medium text-[#64748B]">
                  Employee Name (Populated dynamically from server match)
                </div>
                <div className="text-base font-bold text-[#475569] mt-0.5">
                  [Matched Employee Name]
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-[#64748B]">Employee ID:</span>
                  <span className="font-mono font-bold text-[#475569]">
                    [Matched ID]
                  </span>
                </div>
              </div>
            )}

            {punchError && (
              <div
                role="alert"
                className="mt-4 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2.5 text-xs sm:text-sm text-[#991B1B]"
              >
                <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <span>{punchError}</span>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                disabled={isSubmittingPunch || !verifiedData}
                onClick={() => handleSelectAttendanceAction('IN')}
                className="min-h-[56px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white font-bold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSubmittingPunch ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                <span>CHECK IN</span>
              </button>

              <button
                type="button"
                disabled={isSubmittingPunch || !verifiedData}
                onClick={() => handleSelectAttendanceAction('OUT')}
                className="min-h-[56px] px-5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white font-bold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSubmittingPunch ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
                <span>CHECK OUT</span>
              </button>
            </div>

            {!verifiedData && (
              <p className="text-xs text-[#92400E] text-center mt-3">
                Check-In and Check-Out buttons remain disabled during static UI preview.
              </p>
            )}

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={resetToInitialScanner}
                className="min-h-[44px] px-4 rounded-lg text-xs font-semibold text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Cancel &amp; Return to Scanner
              </button>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* CHECK-IN CONFIRMATION                                           */}
        {/* =============================================================== */}
        {!staticPreviewStage &&
          stage === ScannerWorkflowStage.CHECK_IN_SUCCESS &&
          confirmationData && (
            <div className="max-w-lg mx-auto w-full bg-white border border-[#BBF7D0] rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-[#16A34A] text-white p-6 sm:p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-white text-[#166534] text-xs font-extrabold tracking-wider">
                  IN
                </span>
                <h1 className="text-2xl font-bold mt-3 tracking-tight">
                  CHECK-IN SUCCESSFUL
                </h1>
                <p className="text-sm text-white/90 mt-1">
                  Your check-in has been recorded successfully.
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <dl className="divide-y divide-[#F1F5F9] text-sm">
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Employee Name</dt>
                    <dd className="font-bold text-[#111827]">
                      {confirmationData.employeeName}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Employee ID</dt>
                    <dd className="font-mono font-bold text-[#111827] tabular-nums-strict">
                      {confirmationData.employeeId}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Date</dt>
                    <dd className="font-mono font-semibold text-[#111827] tabular-nums-strict">
                      {confirmationData.isoTimestamp
                        ? formatRealDate(confirmationData.isoTimestamp)
                        : confirmationData.date}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Check-In Time</dt>
                    <dd className="font-mono font-bold text-[#166534] tabular-nums-strict">
                      {confirmationData.isoTimestamp
                        ? formatRealTime(confirmationData.isoTimestamp)
                        : confirmationData.recordedTime}
                    </dd>
                  </div>
                </dl>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
                    Today&apos;s Attendance
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-[#64748B] block">
                        Check-In
                      </span>
                      <span className="font-mono font-bold text-[#111827] tabular-nums-strict">
                        {confirmationData.todayAttendance.checkInIso
                          ? formatRealTime(confirmationData.todayAttendance.checkInIso)
                          : confirmationData.todayAttendance.checkIn}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748B] block">
                        Check-Out
                      </span>
                      <span className="font-mono font-semibold text-[#64748B] tabular-nums-strict">
                        {confirmationData.todayAttendance.checkOutIso
                          ? formatRealTime(confirmationData.todayAttendance.checkOutIso)
                          : confirmationData.todayAttendance.checkOut}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={resetToInitialScanner}
                    className="w-full min-h-[52px] px-6 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Return to Scanner
                  </button>
                  <p className="text-xs text-[#64748B] text-center mt-2.5 tabular-nums-strict">
                    Session clears automatically in {autoResetSecondsLeft}s.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* =============================================================== */}
        {/* CHECK-OUT CONFIRMATION                                          */}
        {/* =============================================================== */}
        {!staticPreviewStage &&
          stage === ScannerWorkflowStage.CHECK_OUT_SUCCESS &&
          confirmationData && (
            <div className="max-w-lg mx-auto w-full bg-white border border-[#FECACA] rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-[#DC2626] text-white p-6 sm:p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-white text-[#991B1B] text-xs font-extrabold tracking-wider">
                  OUT
                </span>
                <h1 className="text-2xl font-bold mt-3 tracking-tight">
                  CHECK-OUT SUCCESSFUL
                </h1>
                <p className="text-sm text-white/90 mt-1">
                  Your check-out has been recorded successfully.
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <dl className="divide-y divide-[#F1F5F9] text-sm">
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Employee Name</dt>
                    <dd className="font-bold text-[#111827]">
                      {confirmationData.employeeName}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Employee ID</dt>
                    <dd className="font-mono font-bold text-[#111827] tabular-nums-strict">
                      {confirmationData.employeeId}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Date</dt>
                    <dd className="font-mono font-semibold text-[#111827] tabular-nums-strict">
                      {confirmationData.isoTimestamp
                        ? formatRealDate(confirmationData.isoTimestamp)
                        : confirmationData.date}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-[#64748B]">Check-Out Time</dt>
                    <dd className="font-mono font-bold text-[#991B1B] tabular-nums-strict">
                      {confirmationData.isoTimestamp
                        ? formatRealTime(confirmationData.isoTimestamp)
                        : confirmationData.recordedTime}
                    </dd>
                  </div>
                </dl>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
                    Today&apos;s Attendance
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-[#64748B] block">
                        Check-In
                      </span>
                      <span className="font-mono font-bold text-[#111827] tabular-nums-strict">
                        {confirmationData.todayAttendance.checkInIso
                          ? formatRealTime(confirmationData.todayAttendance.checkInIso)
                          : confirmationData.todayAttendance.checkIn}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748B] block">
                        Check-Out
                      </span>
                      <span className="font-mono font-bold text-[#991B1B] tabular-nums-strict">
                        {confirmationData.todayAttendance.checkOutIso
                          ? formatRealTime(confirmationData.todayAttendance.checkOutIso)
                          : confirmationData.todayAttendance.checkOut}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={resetToInitialScanner}
                    className="w-full min-h-[52px] px-6 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Return to Scanner
                  </button>
                  <p className="text-xs text-[#64748B] text-center mt-2.5 tabular-nums-strict">
                    Session clears automatically in {autoResetSecondsLeft}s.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* =============================================================== */}
        {/* SEPARATE UI DESIGN STATE INSPECTOR (NON-FUNCTIONAL PREVIEW)     */}
        {/* =============================================================== */}
        {!isConfirmationStage && (
          <div className="mt-6 max-w-3xl mx-auto w-full">
            <button
              type="button"
              onClick={() => setShowStateInspector((v) => !v)}
              className="mx-auto min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#111827] hover:bg-white border border-transparent hover:border-[#E2E8F0] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>UI Screen State Inspector (Design Preview — Not Recognition)</span>
              {showStateInspector ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showStateInspector && (
              <div className="mt-2 p-4 sm:p-5 rounded-2xl bg-white border border-dashed border-[#CBD5E1] space-y-3">
                <p className="text-xs text-[#475569] leading-relaxed">
                  <strong>Design State Navigation (Non-Functional):</strong> Use these buttons only to review the separate UI screen layouts if your current device or embedded preview environment cannot access a hardware webcam. To perform genuine facial matching, enroll an employee via webcam in the <strong>Administrator Panel</strong> and use <strong>Start Face Scan</strong>.
                </p>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: null, label: 'Live Mode (Initial)' },
                      { id: 'CAMERA_ACTIVATION', label: '1. Camera Activation' },
                      { id: 'WAITING_FOR_FACE', label: '2. Waiting for Face' },
                      { id: 'VERIFYING_IDENTITY', label: '3. Verifying Identity' },
                      {
                        id: 'VERIFIED_IDENTITY',
                        label: '4. Verified Layout (Disabled)',
                      },
                      {
                        id: 'FACE_NOT_RECOGNIZED',
                        label: '5. Face Not Recognized',
                      },
                      { id: 'CAMERA_ERROR', label: '6. Camera Error' },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleActivateStaticPreview(btn.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        staticPreviewStage === btn.id
                          ? 'bg-[#111827] text-white border-[#111827]'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:text-[#111827]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
