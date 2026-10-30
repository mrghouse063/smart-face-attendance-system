import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanFace,
  Users,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import {
  detectLiveFace,
  ensureFaceRecognitionModels,
  extractFaceDescriptorFromVideo,
  requestUserCameraStream,
  stopMediaStream,
} from '../../services/faceRecognitionEngine';
import {
  AdminScreenRoute,
  EmployeeDirectoryItem,
  FacialEnrollmentState,
} from '../../types/attendance';
import { CameraViewport, ViewportVisualState } from '../CameraViewport';

interface RegisterEmployeeScreenProps {
  onNavigate: (route: AdminScreenRoute) => void;
  onOpenScannerStation: () => void;
  onSessionExpired: () => void;
}

const TOTAL_REQUIRED_SAMPLES = 5;

export const RegisterEmployeeScreen: React.FC<RegisterEmployeeScreenProps> = ({
  onNavigate,
  onOpenScannerStation,
  onSessionExpired,
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountStatus, setAccountStatus] = useState<'Active' | 'Inactive'>(
    'Active'
  );

  const [enrollmentState, setEnrollmentState] = useState<FacialEnrollmentState>(
    FacialEnrollmentState.WAITING_FOR_CAMERA
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>(
    []
  );
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [registeredEmployee, setRegisteredEmployee] =
    useState<EmployeeDirectoryItem | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monitorLoopRef = useRef<boolean>(false);

  const cleanupCamera = useCallback(() => {
    monitorLoopRef.current = false;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupCamera();
    };
  }, [cleanupCamera]);

  const handleActivateCamera = async () => {
    cleanupCamera();
    setFormError(null);
    setEnrollmentError(null);
    setCapturedDescriptors([]);
    setEnrollmentState(FacialEnrollmentState.ACTIVATING_CAMERA);

    try {
      const [mediaStream] = await Promise.all([
        requestUserCameraStream(),
        ensureFaceRecognitionModels(),
      ]);

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setEnrollmentState(FacialEnrollmentState.CAMERA_ACTIVE_NO_FACE);
      monitorLoopRef.current = true;
      runFacePresenceMonitor();
    } catch (err) {
      cleanupCamera();
      setEnrollmentError(
        err instanceof Error
          ? err.message
          : 'Unable to access camera or load facial recognition models.'
      );
      setEnrollmentState(FacialEnrollmentState.ENROLLMENT_FAILED);
    }
  };

  const runFacePresenceMonitor = async () => {
    while (monitorLoopRef.current) {
      const videoEl = videoRef.current;
      if (videoEl && videoEl.readyState >= 2) {
        try {
          const check = await detectLiveFace(videoEl);
          if (!monitorLoopRef.current) return;
          setEnrollmentState((prev) => {
            if (
              prev === FacialEnrollmentState.CAPTURING_SAMPLES ||
              prev === FacialEnrollmentState.PROCESSING_DATA ||
              prev === FacialEnrollmentState.ENROLLMENT_SUCCESS
            ) {
              return prev;
            }
            return check.detected
              ? FacialEnrollmentState.FACE_DETECTED
              : FacialEnrollmentState.CAMERA_ACTIVE_NO_FACE;
          });
        } catch {
          // Ignore single frame check error
        }
      }
      await new Promise((r) => window.setTimeout(r, 250));
    }
  };

  const handleCaptureFaceSamples = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !streamRef.current) return;

    monitorLoopRef.current = false;
    setEnrollmentError(null);
    setFormError(null);
    setCapturedDescriptors([]);
    setEnrollmentState(FacialEnrollmentState.CAPTURING_SAMPLES);

    const collected: number[][] = [];
    let attempts = 0;

    while (collected.length < TOTAL_REQUIRED_SAMPLES && attempts < 24) {
      attempts += 1;
      try {
        const sample = await extractFaceDescriptorFromVideo(videoEl);
        if (sample) {
          collected.push(sample.descriptor);
          setCapturedDescriptors([...collected]);
        }
      } catch {
        // Continue trying within attempt budget
      }
      await new Promise((r) => window.setTimeout(r, 260));
    }

    if (collected.length < TOTAL_REQUIRED_SAMPLES) {
      cleanupCamera();
      setCapturedDescriptors([]);
      setEnrollmentError(
        `Face enrollment failed: Only ${collected.length} of ${TOTAL_REQUIRED_SAMPLES} clear face samples could be captured. Ensure your face stays centered and well-lit inside the oval.`
      );
      setEnrollmentState(FacialEnrollmentState.ENROLLMENT_FAILED);
      return;
    }

    setEnrollmentState(FacialEnrollmentState.PROCESSING_DATA);
    await new Promise((r) => window.setTimeout(r, 350));
    cleanupCamera();
    setEnrollmentState(FacialEnrollmentState.ENROLLMENT_SUCCESS);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!employeeId.trim()) {
      setFormError('Employee ID is required and must be manually entered.');
      return;
    }
    if (!fullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (
      enrollmentState !== FacialEnrollmentState.ENROLLMENT_SUCCESS ||
      capturedDescriptors.length < TOTAL_REQUIRED_SAMPLES
    ) {
      setFormError(
        'Genuine 5-sample facial enrollment must be completed before saving the employee.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await attendanceApi.registerEmployee({
        employeeId: employeeId.trim().toUpperCase(),
        fullName: fullName.trim(),
        accountStatus,
        descriptors: capturedDescriptors,
      });
      setRegisteredEmployee(res.employee);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) {
        onSessionExpired();
        return;
      }
      setFormError(apiErr.message || 'Employee registration failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetFormForNewEmployee = () => {
    cleanupCamera();
    setEmployeeId('');
    setFullName('');
    setAccountStatus('Active');
    setCapturedDescriptors([]);
    setEnrollmentError(null);
    setEnrollmentState(FacialEnrollmentState.WAITING_FOR_CAMERA);
    setFormError(null);
    setRegisteredEmployee(null);
  };

  const getViewportVisualState = (): ViewportVisualState => {
    switch (enrollmentState) {
      case FacialEnrollmentState.WAITING_FOR_CAMERA:
        return 'IDLE';
      case FacialEnrollmentState.ACTIVATING_CAMERA:
        return 'ACTIVATING';
      case FacialEnrollmentState.CAMERA_ACTIVE_NO_FACE:
        return 'LIVE_WAITING_FACE';
      case FacialEnrollmentState.FACE_DETECTED:
      case FacialEnrollmentState.CAPTURING_SAMPLES:
      case FacialEnrollmentState.PROCESSING_DATA:
        return 'LIVE_VERIFYING';
      case FacialEnrollmentState.ENROLLMENT_SUCCESS:
        return 'MATCH_SUCCESS';
      case FacialEnrollmentState.ENROLLMENT_FAILED:
        return 'CAMERA_ERROR';
    }
  };

  const getEnrollmentStatusLabel = (): string => {
    switch (enrollmentState) {
      case FacialEnrollmentState.WAITING_FOR_CAMERA:
        return 'Click "Activate Camera" to start live enrollment';
      case FacialEnrollmentState.ACTIVATING_CAMERA:
        return 'Starting camera & loading recognition model...';
      case FacialEnrollmentState.CAMERA_ACTIVE_NO_FACE:
        return 'Camera active — position face inside oval';
      case FacialEnrollmentState.FACE_DETECTED:
        return 'Face detected — ready to capture samples';
      case FacialEnrollmentState.CAPTURING_SAMPLES:
        return `Capturing face samples (${capturedDescriptors.length} / ${TOTAL_REQUIRED_SAMPLES})...`;
      case FacialEnrollmentState.PROCESSING_DATA:
        return 'Processing facial templates...';
      case FacialEnrollmentState.ENROLLMENT_SUCCESS:
        return 'Face enrollment successful';
      case FacialEnrollmentState.ENROLLMENT_FAILED:
        return 'Face enrollment failed';
    }
  };

  if (registeredEmployee) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-[#BBF7D0] rounded-3xl overflow-hidden shadow-xs">
        <div className="bg-[#16A34A] text-white p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Employee Registered Successfully</h1>
          <p className="text-sm text-white/90 mt-1">
            Live facial templates saved. This employee can now scan their face at the attendance scanner.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <dl className="divide-y divide-[#F1F5F9] text-sm">
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#64748B]">Employee Name</dt>
              <dd className="font-bold text-[#111827]">
                {registeredEmployee.fullName}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#64748B]">Employee ID</dt>
              <dd className="font-mono font-bold text-[#111827] tabular-nums-strict">
                {registeredEmployee.employeeId}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#64748B]">Account Status</dt>
              <dd className="font-semibold text-[#111827]">
                {registeredEmployee.accountStatus}
              </dd>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <dt className="text-[#64748B]">Facial Enrollment Status</dt>
              <dd className="inline-flex items-center gap-1.5 font-bold text-[#166534]">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Completed ({registeredEmployee.enrolledSampleCount} samples)</span>
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate(AdminScreenRoute.EMPLOYEE_DIRECTORY)}
              className="min-h-[48px] px-4 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Employee Directory</span>
            </button>

            <button
              type="button"
              onClick={onOpenScannerStation}
              className="min-h-[48px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ScanFace className="w-4 h-4" />
              <span>Open Attendance Scanner</span>
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={resetFormForNewEmployee}
              className="min-h-[40px] px-4 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              + Register Another Employee
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Add New Employee</h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Manually assign a unique Employee ID and capture live camera facial templates before permitting scanner access.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3 text-sm text-[#991B1B]"
        >
          <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmitRegistration}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left Column: Employee Details */}
        <section className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="pb-3 border-b border-[#E2E8F0]">
            <h2 className="text-base font-bold text-[#111827]">
              1. Employee Details
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Each employee requires a unique identifier and verified full name.
            </p>
          </div>

          <div>
            <label
              htmlFor="reg-emp-id"
              className="block text-xs font-semibold text-[#111827] mb-1.5"
            >
              Employee ID <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="reg-emp-id"
              type="text"
              required
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value.toUpperCase());
                setFormError(null);
              }}
              placeholder="e.g., EMP005"
              className="w-full h-12 px-4 rounded-xl bg-white border border-[#CBD5E1] font-mono text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label
              htmlFor="reg-full-name"
              className="block text-xs font-semibold text-[#111827] mb-1.5"
            >
              Full Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="reg-full-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFormError(null);
              }}
              placeholder="Enter employee full name"
              className="w-full h-12 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label
              htmlFor="reg-status"
              className="block text-xs font-semibold text-[#111827] mb-1.5"
            >
              Account Status
            </label>
            <select
              id="reg-status"
              value={accountStatus}
              onChange={(e) =>
                setAccountStatus(e.target.value as 'Active' | 'Inactive')
              }
              className="w-full h-12 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="Active">Active (Default — Permitted to Scan)</option>
              <option value="Inactive">Inactive (Attendance Disabled)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={() => {
                cleanupCamera();
                onNavigate(AdminScreenRoute.DASHBOARD);
              }}
              className="min-h-[48px] px-5 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-sm font-semibold text-[#475569] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                enrollmentState !== FacialEnrollmentState.ENROLLMENT_SUCCESS
              }
              className="flex-1 min-h-[48px] px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Employee...</span>
                </>
              ) : (
                <span>Register Employee</span>
              )}
            </button>
          </div>
          {enrollmentState !== FacialEnrollmentState.ENROLLMENT_SUCCESS && (
            <p className="text-xs text-[#64748B]">
              Complete live camera facial enrollment (5 real samples) in Step 2 to enable registration.
            </p>
          )}
        </section>

        {/* Right Column: Live Camera Facial Enrollment */}
        <section className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                2. Live Facial Enrollment
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Requires real camera access and 5 detected facial frames.
              </p>
            </div>
            {enrollmentState === FacialEnrollmentState.ENROLLMENT_SUCCESS && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#166534] text-xs font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                Completed
              </span>
            )}
          </div>

          <CameraViewport
            visualState={getViewportVisualState()}
            stream={stream}
            videoRef={videoRef}
            statusText={getEnrollmentStatusLabel()}
            errorTitle="Enrollment Camera Unavailable"
            errorDetail={enrollmentError || undefined}
            onRetry={handleActivateCamera}
          />

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111827]">
                {getEnrollmentStatusLabel()}
              </span>
              <span className="font-mono font-bold text-[#111827] tabular-nums-strict">
                {capturedDescriptors.length} / {TOTAL_REQUIRED_SAMPLES} samples
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                style={{
                  width: `${
                    (capturedDescriptors.length / TOTAL_REQUIRED_SAMPLES) * 100
                  }%`,
                }}
                className={`h-full transition-all duration-200 ${
                  enrollmentState === FacialEnrollmentState.ENROLLMENT_FAILED
                    ? 'bg-[#DC2626]'
                    : 'bg-[#16A34A]'
                }`}
              />
            </div>

            <p className="text-xs text-[#64748B]">
              Keep the employee&apos;s face centered inside the oval guide under even lighting while capturing all 5 samples.
            </p>
          </div>

          {enrollmentError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
            >
              {enrollmentError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {enrollmentState === FacialEnrollmentState.WAITING_FOR_CAMERA && (
              <button
                type="button"
                onClick={handleActivateCamera}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Activate Camera</span>
              </button>
            )}

            {(enrollmentState === FacialEnrollmentState.CAMERA_ACTIVE_NO_FACE ||
              enrollmentState === FacialEnrollmentState.FACE_DETECTED) && (
              <button
                type="button"
                disabled={enrollmentState !== FacialEnrollmentState.FACE_DETECTED}
                onClick={handleCaptureFaceSamples}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ScanFace className="w-4 h-4" />
                <span>
                  {enrollmentState === FacialEnrollmentState.FACE_DETECTED
                    ? 'Capture 5 Face Samples'
                    : 'Position Face in Frame to Enable Capture'}
                </span>
              </button>
            )}

            {(enrollmentState === FacialEnrollmentState.ENROLLMENT_SUCCESS ||
              enrollmentState === FacialEnrollmentState.ENROLLMENT_FAILED) && (
              <button
                type="button"
                onClick={handleActivateCamera}
                className="w-full min-h-[46px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#111827] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recapture Live Samples</span>
              </button>
            )}
          </div>
        </section>
      </form>
    </div>
  );
};
