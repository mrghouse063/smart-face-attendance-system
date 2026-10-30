import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ScanFace,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import {
  detectLiveFace,
  ensureFaceRecognitionModels,
  extractFaceDescriptorFromVideo,
  requestUserCameraStream,
  stopMediaStream,
} from '../../services/faceRecognitionEngine';
import { AdminScreenRoute, EmployeeDirectoryItem } from '../../types/attendance';
import { CameraViewport } from '../CameraViewport';
import { EmployeeAvatar } from '../EmployeeAvatar';
import { AccountStatusBadge } from '../StatusBadge';

interface EmployeeDirectoryScreenProps {
  onNavigate: (route: AdminScreenRoute) => void;
  onSessionExpired: () => void;
}

export const EmployeeDirectoryScreen: React.FC<
  EmployeeDirectoryScreenProps
> = ({ onNavigate, onSessionExpired }) => {
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Active' | 'Inactive'
  >('All');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [viewingEmployee, setViewingEmployee] =
    useState<EmployeeDirectoryItem | null>(null);
  const [reenrollingEmployee, setReenrollingEmployee] =
    useState<EmployeeDirectoryItem | null>(null);

  // Delete Employee Confirmation Modal State
  const [deletingEmployee, setDeletingEmployee] =
    useState<EmployeeDirectoryItem | null>(null);
  const [removeAttendanceHistory, setRemoveAttendanceHistory] =
    useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Live Camera Re-Enrollment State
  const [reenrollStream, setReenrollStream] = useState<MediaStream | null>(null);
  const [reenrollStage, setReenrollStage] = useState<
    | 'IDLE'
    | 'ACTIVATING'
    | 'WAITING_FACE'
    | 'FACE_READY'
    | 'CAPTURING'
    | 'COMPLETED'
    | 'ERROR'
  >('IDLE');
  const [reenrollDescriptors, setReenrollDescriptors] = useState<number[][]>([]);
  const [reenrollError, setReenrollError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monitorLoopRef = useRef<boolean>(false);

  const cleanupReenrollCamera = useCallback(() => {
    monitorLoopRef.current = false;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setReenrollStream(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupReenrollCamera();
    };
  }, [cleanupReenrollCamera]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getEmployees({
        search,
        status: statusFilter,
      });
      setEmployees(res.employees);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) {
        onSessionExpired();
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, onSessionExpired]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleToggleStatus = async (emp: EmployeeDirectoryItem) => {
    const nextStatus = emp.accountStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await attendanceApi.updateEmployeeStatus(
        emp.employeeId,
        nextStatus
      );
      setEmployees((prev) =>
        prev.map((item) =>
          item.employeeId === emp.employeeId ? res.employee : item
        )
      );
      if (viewingEmployee?.employeeId === emp.employeeId) {
        setViewingEmployee(res.employee);
      }
      showToast(
        nextStatus === 'Inactive'
          ? `${emp.fullName} (${emp.employeeId}) deactivated. Scanner access blocked; historical attendance preserved.`
          : `${emp.fullName} (${emp.employeeId}) activated.`
      );
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) onSessionExpired();
    }
  };

  const openDeleteModal = (emp: EmployeeDirectoryItem) => {
    setDeleteError(null);
    setRemoveAttendanceHistory(true);
    setDeletingEmployee(emp);
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!deletingEmployee || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await attendanceApi.deleteEmployee(
        deletingEmployee.employeeId,
        removeAttendanceHistory
      );
      setEmployees((prev) =>
        prev.filter((item) => item.employeeId !== deletingEmployee.employeeId)
      );
      if (viewingEmployee?.employeeId === deletingEmployee.employeeId) {
        setViewingEmployee(null);
      }
      showToast(
        removeAttendanceHistory
          ? `Deleted ${res.employeeName} (${res.employeeId}), facial templates, and ${res.removedEventsCount} attendance record(s).`
          : `Deleted ${res.employeeName} (${res.employeeId}) profile and facial templates.`
      );
      setDeletingEmployee(null);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) {
        onSessionExpired();
        return;
      }
      setDeleteError(apiErr.message || 'Failed to delete employee data.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openReenrollmentModal = (emp: EmployeeDirectoryItem) => {
    cleanupReenrollCamera();
    setReenrollingEmployee(emp);
    setReenrollDescriptors([]);
    setReenrollError(null);
    setReenrollStage('IDLE');
  };

  const closeReenrollmentModal = () => {
    cleanupReenrollCamera();
    setReenrollingEmployee(null);
  };

  const handleStartReenrollCamera = async () => {
    cleanupReenrollCamera();
    setReenrollError(null);
    setReenrollDescriptors([]);
    setReenrollStage('ACTIVATING');

    try {
      const [media] = await Promise.all([
        requestUserCameraStream(),
        ensureFaceRecognitionModels(),
      ]);
      streamRef.current = media;
      setReenrollStream(media);
      setReenrollStage('WAITING_FACE');
      monitorLoopRef.current = true;

      while (monitorLoopRef.current) {
        const videoEl = videoRef.current;
        if (videoEl && videoEl.readyState >= 2) {
          const check = await detectLiveFace(videoEl);
          if (!monitorLoopRef.current) return;
          setReenrollStage((prev) =>
            prev === 'CAPTURING' || prev === 'COMPLETED'
              ? prev
              : check.detected
                ? 'FACE_READY'
                : 'WAITING_FACE'
          );
        }
        await new Promise((r) => window.setTimeout(r, 250));
      }
    } catch (err) {
      cleanupReenrollCamera();
      setReenrollError(
        err instanceof Error
          ? err.message
          : 'Unable to open camera or load recognition models.'
      );
      setReenrollStage('ERROR');
    }
  };

  const handleCaptureReenrollSamples = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !streamRef.current) return;

    monitorLoopRef.current = false;
    setReenrollError(null);
    setReenrollDescriptors([]);
    setReenrollStage('CAPTURING');

    const collected: number[][] = [];
    let attempts = 0;

    while (collected.length < 5 && attempts < 24) {
      attempts += 1;
      try {
        const sample = await extractFaceDescriptorFromVideo(videoEl);
        if (sample) {
          collected.push(sample.descriptor);
          setReenrollDescriptors([...collected]);
        }
      } catch {
        // Retry next frame
      }
      await new Promise((r) => window.setTimeout(r, 260));
    }

    cleanupReenrollCamera();

    if (collected.length < 5) {
      setReenrollDescriptors([]);
      setReenrollError(
        `Captured only ${collected.length} of 5 clear face samples. Keep face centered in the oval and retry.`
      );
      setReenrollStage('ERROR');
      return;
    }

    setReenrollStage('COMPLETED');
  };

  const handleSaveUpdatedEnrollment = async () => {
    if (!reenrollingEmployee || reenrollDescriptors.length < 5) return;
    setIsUpdating(true);
    try {
      const res = await attendanceApi.updateFacialEnrollment(
        reenrollingEmployee.employeeId,
        reenrollDescriptors
      );
      setEmployees((prev) =>
        prev.map((item) =>
          item.employeeId === reenrollingEmployee.employeeId
            ? res.employee
            : item
        )
      );
      showToast(
        `Saved live facial enrollment (5 templates) for ${reenrollingEmployee.fullName} (${reenrollingEmployee.employeeId}).`
      );
      closeReenrollmentModal();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) onSessionExpired();
      else setReenrollError(apiErr.message || 'Failed to save facial enrollment.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">
            Employee Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Manage registered employees, enroll live facial templates, control scanner access, or delete employee data.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(AdminScreenRoute.REGISTER_EMPLOYEE)}
          className="min-h-[46px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {toastMessage && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs sm:text-sm font-medium text-[#166534] flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search & Status Filter */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Employee ID or Full Name..."
            aria-label="Search employees by ID or Name"
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl h-12">
          {(['All', 'Active', 'Inactive'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`flex-1 sm:flex-none h-full px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#64748B] hover:text-[#111827]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table / Mobile Cards */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-base font-bold text-[#111827]">
              No matching employees found
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Adjust your search filter or register a new employee.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Employee ID
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Full Name
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Facial Template
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Account Status
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {employees.map((emp) => (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#111827] tabular-nums-strict">
                        {emp.employeeId}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            name={emp.fullName}
                            color={emp.avatarColor}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-[#111827]">
                              {emp.fullName}
                            </div>
                            <div className="text-xs font-mono text-[#64748B] tabular-nums-strict">
                              Reg: {emp.registrationDate}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        {emp.facialEnrollmentStatus === 'Completed' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                            <span>Enrolled ({emp.enrolledSampleCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#92400E]">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                            <span>Needs Camera Enrollment</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <AccountStatusBadge status={emp.accountStatus} />
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingEmployee(emp)}
                            className="min-h-[36px] px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openReenrollmentModal(emp)}
                            className="min-h-[36px] px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#EFF6FF] text-xs font-semibold text-[#2563EB] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>
                              {emp.facialEnrollmentStatus === 'Completed'
                                ? 'Update Face'
                                : 'Enroll Face'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp)}
                            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                              emp.accountStatus === 'Active'
                                ? 'bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569]'
                                : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#166534]'
                            }`}
                          >
                            {emp.accountStatus === 'Active' ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(emp)}
                            aria-label={`Delete ${emp.fullName}`}
                            className="min-h-[36px] px-3 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {employees.map((emp) => (
                <div key={emp.employeeId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <EmployeeAvatar
                        name={emp.fullName}
                        color={emp.avatarColor}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111827] truncate">
                          {emp.fullName}
                        </p>
                        <p className="text-xs font-mono text-[#64748B] tabular-nums-strict">
                          {emp.employeeId} · {emp.facialEnrollmentStatus}
                        </p>
                      </div>
                    </div>
                    <AccountStatusBadge status={emp.accountStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewingEmployee(emp)}
                      className="min-h-[42px] px-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#111827]"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => openReenrollmentModal(emp)}
                      className="min-h-[42px] px-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#2563EB]"
                    >
                      {emp.facialEnrollmentStatus === 'Completed'
                        ? 'Update Face'
                        : 'Enroll Face'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(emp)}
                      className={`min-h-[42px] px-2 rounded-lg text-xs font-semibold ${
                        emp.accountStatus === 'Active'
                          ? 'bg-[#F1F5F9] text-[#475569]'
                          : 'bg-[#DCFCE7] text-[#166534]'
                      }`}
                    >
                      {emp.accountStatus === 'Active'
                        ? 'Deactivate'
                        : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(emp)}
                      className="min-h-[42px] px-2 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* View Employee Modal */}
      {viewingEmployee && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-emp-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  name={viewingEmployee.fullName}
                  color={viewingEmployee.avatarColor}
                  size="md"
                />
                <div>
                  <h2
                    id="view-emp-title"
                    className="text-base font-bold text-[#111827]"
                  >
                    {viewingEmployee.fullName}
                  </h2>
                  <p className="text-xs font-mono text-[#64748B]">
                    {viewingEmployee.employeeId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                aria-label="Close modal"
                className="min-w-[40px] min-h-[40px] rounded-lg text-[#64748B] hover:bg-[#F1F5F9] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="mt-4 divide-y divide-[#F1F5F9] text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-[#64748B]">Account Status</dt>
                <dd>
                  <AccountStatusBadge status={viewingEmployee.accountStatus} />
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-[#64748B]">Registration Date</dt>
                <dd className="font-mono text-xs font-semibold text-[#111827] tabular-nums-strict">
                  {viewingEmployee.registrationDate}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-[#64748B]">Facial Enrollment</dt>
                <dd
                  className={`text-xs font-bold ${
                    viewingEmployee.facialEnrollmentStatus === 'Completed'
                      ? 'text-[#166534]'
                      : 'text-[#92400E]'
                  }`}
                >
                  {viewingEmployee.facialEnrollmentStatus === 'Completed'
                    ? `Completed (${viewingEmployee.enrolledSampleCount} samples)`
                    : 'Pending Camera Enrollment'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  const target = viewingEmployee;
                  setViewingEmployee(null);
                  openDeleteModal(target);
                }}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Employee</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingEmployee;
                    setViewingEmployee(null);
                    openReenrollmentModal(target);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer"
                >
                  {viewingEmployee.facialEnrollmentStatus === 'Completed'
                    ? 'Update Face'
                    : 'Enroll Face'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#111827] text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deletingEmployee && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-emp-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#FECACA] space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="delete-emp-title"
                    className="text-base font-bold text-[#111827]"
                  >
                    Delete Employee Data
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    This action permanently removes the employee from the system.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingEmployee(null)}
                aria-label="Close delete confirmation"
                className="min-w-[38px] min-h-[38px] rounded-lg text-[#64748B] hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
              <EmployeeAvatar
                name={deletingEmployee.fullName}
                color={deletingEmployee.avatarColor}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111827] truncate">
                  {deletingEmployee.fullName}
                </p>
                <p className="text-xs font-mono text-[#64748B] tabular-nums-strict">
                  ID: {deletingEmployee.employeeId} · {deletingEmployee.enrolledSampleCount} facial sample(s)
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={removeAttendanceHistory}
                onChange={(e) => setRemoveAttendanceHistory(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#DC2626] cursor-pointer"
              />
              <span className="text-xs text-[#7F1D1D] leading-relaxed">
                <strong>Also delete all attendance history records</strong> belonging to{' '}
                {deletingEmployee.fullName} ({deletingEmployee.employeeId}).
              </span>
            </label>

            {deleteError && (
              <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingEmployee(null)}
                className="min-h-[46px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteEmployee}
                className="min-h-[46px] px-5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Employee</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Facial Enrollment Modal */}
      {reenrollingEmployee && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reenroll-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2
                  id="reenroll-title"
                  className="text-base font-bold text-[#111827]"
                >
                  Live Camera Facial Enrollment
                </h2>
                <p className="text-xs text-[#64748B]">
                  {reenrollingEmployee.fullName} ({reenrollingEmployee.employeeId})
                </p>
              </div>
              <button
                type="button"
                onClick={closeReenrollmentModal}
                aria-label="Close modal"
                className="min-w-[40px] min-h-[40px] rounded-lg text-[#64748B] hover:bg-[#F1F5F9] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <CameraViewport
              visualState={
                reenrollStage === 'IDLE'
                  ? 'IDLE'
                  : reenrollStage === 'ACTIVATING'
                    ? 'ACTIVATING'
                    : reenrollStage === 'WAITING_FACE'
                      ? 'LIVE_WAITING_FACE'
                      : reenrollStage === 'FACE_READY' ||
                          reenrollStage === 'CAPTURING'
                        ? 'LIVE_VERIFYING'
                        : reenrollStage === 'COMPLETED'
                          ? 'MATCH_SUCCESS'
                          : 'CAMERA_ERROR'
              }
              stream={reenrollStream}
              videoRef={videoRef}
              statusText={
                reenrollStage === 'IDLE'
                  ? 'Open camera to capture 5 live facial samples'
                  : reenrollStage === 'ACTIVATING'
                    ? 'Starting camera & loading model...'
                    : reenrollStage === 'WAITING_FACE'
                      ? 'Position face inside the oval guide'
                      : reenrollStage === 'FACE_READY'
                        ? 'Face detected — ready to capture'
                        : reenrollStage === 'CAPTURING'
                          ? `Capturing samples (${reenrollDescriptors.length} / 5)...`
                          : reenrollStage === 'COMPLETED'
                            ? '5 live samples captured — ready to save'
                            : 'Camera or capture error'
              }
              errorTitle="Camera Enrollment Unavailable"
              errorDetail={reenrollError || undefined}
              onRetry={handleStartReenrollCamera}
            />

            <div className="flex items-center justify-between text-xs text-[#475569]">
              <span>Captured Live Samples</span>
              <span className="font-mono font-bold text-[#111827] tabular-nums-strict">
                {reenrollDescriptors.length} / 5
              </span>
            </div>

            {reenrollError && (
              <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3">
                {reenrollError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              {reenrollStage === 'IDLE' && (
                <button
                  type="button"
                  onClick={handleStartReenrollCamera}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Activate Camera</span>
                </button>
              )}

              {(reenrollStage === 'WAITING_FACE' ||
                reenrollStage === 'FACE_READY') && (
                <button
                  type="button"
                  disabled={reenrollStage !== 'FACE_READY'}
                  onClick={handleCaptureReenrollSamples}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>
                    {reenrollStage === 'FACE_READY'
                      ? 'Capture 5 Live Samples'
                      : 'Waiting for Face in Frame...'}
                  </span>
                </button>
              )}

              {reenrollStage === 'COMPLETED' && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSaveUpdatedEnrollment}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save Facial Enrollment</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
