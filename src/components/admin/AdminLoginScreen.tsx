import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { attendanceApi, setStoredAdminToken } from '../../services/api';

interface AdminLoginScreenProps {
  onLoginSuccess: (admin: { email: string; name: string }) => void;
  onBackToScanner: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLoginSuccess,
  onBackToScanner,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError('Please enter your administrator email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setValidationError('Please enter a valid email address format.');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await attendanceApi.adminLogin(trimmedEmail, password);
      setStoredAdminToken(res.token);
      onLoginSuccess(res.admin);
    } catch (err) {
      setValidationError(
        (err as Error).message || 'Authentication failed. Authorized administrators only.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#111827] text-white flex items-center justify-center">
            <ScanFace className="w-5 h-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#111827]">
            Smart Attendance
          </span>
        </div>

        <button
          type="button"
          onClick={onBackToScanner}
          className="min-h-[44px] px-3.5 rounded-lg text-xs font-semibold text-[#475569] hover:text-[#111827] hover:bg-[#F1F5F9] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Employee Scanner</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-xs">
          {/* Logo & Heading */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#111827] text-white flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#111827]">Administrator Login</h1>
            <p className="text-sm text-[#64748B] mt-1 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Authorized administrators only.</span>
            </p>
          </div>

          {validationError && (
            <div
              role="alert"
              className="mt-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2.5 text-xs sm:text-sm text-[#991B1B]"
            >
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-[#111827] mb-1.5"
              >
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setValidationError(null);
                }}
                placeholder="admin@smartattendance.io"
                className="w-full h-12 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-[#111827] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="Enter administrator password"
                  className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[50px] px-6 rounded-xl bg-[#111827] hover:bg-[#1E293B] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Prototype Demo Helper (No public registration permitted) */}
          <div className="mt-6 pt-5 border-t border-[#F1F5F9]">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-xs text-[#475569] space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span>
                  <strong>Prototype Evaluation Credentials:</strong> Public registration is disabled. Use the pre-provisioned administrator account to inspect Screens 6–9:
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <code className="text-[11px] font-mono text-[#111827]">
                  admin@smartattendance.io / Admin@2026
                </code>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@smartattendance.io');
                    setPassword('Admin@2026');
                    setValidationError(null);
                  }}
                  className="min-h-[34px] px-3 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Auto-Fill
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
