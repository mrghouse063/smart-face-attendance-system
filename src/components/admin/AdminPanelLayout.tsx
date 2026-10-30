import React, { useState } from 'react';
import {
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanFace,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AdminScreenRoute } from '../../types/attendance';
import { PWAInstallButton } from '../PWAInstallButton';

interface AdminPanelLayoutProps {
  activeRoute: AdminScreenRoute;
  adminInfo: { email: string; name: string };
  onNavigate: (route: AdminScreenRoute) => void;
  onLogout: () => void;
  onOpenScannerStation: () => void;
  children: React.ReactNode;
}

export const AdminPanelLayout: React.FC<AdminPanelLayoutProps> = ({
  activeRoute,
  adminInfo,
  onNavigate,
  onLogout,
  onOpenScannerStation,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks: {
    id: AdminScreenRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: AdminScreenRoute.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AdminScreenRoute.REGISTER_EMPLOYEE, label: 'Register Employee', icon: UserPlus },
    { id: AdminScreenRoute.EMPLOYEE_DIRECTORY, label: 'Employee Directory', icon: Users },
    { id: AdminScreenRoute.ATTENDANCE_HISTORY, label: 'Attendance History', icon: CalendarClock },
  ];

  const pageTitle = {
    [AdminScreenRoute.DASHBOARD]: 'Dashboard Overview',
    [AdminScreenRoute.REGISTER_EMPLOYEE]: 'Register Employee',
    [AdminScreenRoute.EMPLOYEE_DIRECTORY]: 'Employee Directory',
    [AdminScreenRoute.ATTENDANCE_HISTORY]: 'Company Attendance History',
  }[activeRoute];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#111827] text-white border-r border-[#1F2937] z-30">
        <div className="h-16 px-6 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white flex items-center justify-center shrink-0">
            <ScanFace className="w-4 h-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            Smart Attendance
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5" aria-label="Administrator Navigation">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#CBD5E1] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <PWAInstallButton variant="sidebar" />
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-white truncate">{adminInfo.name}</p>
            <p className="text-[11px] text-[#94A3B8] truncate">{adminInfo.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] px-3.5 rounded-xl text-sm font-medium text-[#FCA5A5] hover:bg-[#DC2626]/15 flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-h-screen">
        {/* Compact Top Header */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open administrator navigation menu"
              className="lg:hidden min-w-[44px] min-h-[44px] rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#111827] hover:bg-[#F8FAFC]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline font-medium text-[#64748B] whitespace-nowrap">
                Admin Panel
              </span>
              <span className="hidden sm:inline text-[#CBD5E1]" aria-hidden="true">
                /
              </span>
              <span className="font-bold text-[#111827] truncate">{pageTitle}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenScannerStation}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ScanFace className="w-4 h-4 text-[#16A34A]" />
            <span>Open Scanner View</span>
          </button>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/55 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Administrator navigation drawer"
        >
          <div className="w-72 max-w-[82vw] bg-[#111827] text-white h-full flex flex-col p-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white flex items-center justify-center">
                  <ScanFace className="w-4 h-4" />
                </div>
                <span className="font-display font-bold text-base">Smart Attendance</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-w-[40px] min-h-[40px] rounded-lg text-[#CBD5E1] hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1.5">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[48px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium ${
                      isActive
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#CBD5E1] hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-white/10 space-y-2">
              <PWAInstallButton variant="sidebar" />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full min-h-[48px] px-3.5 rounded-xl text-sm font-medium text-[#FCA5A5] hover:bg-[#DC2626]/15 flex items-center gap-3"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
};
