import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Info,
  Loader2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import { AdminScreenRoute, DashboardData } from '../../types/attendance';
import { formatRealDate, formatRealTime } from '../../utils/dateTime';
import { EventStatusBadge } from '../StatusBadge';

interface AdminDashboardScreenProps {
  onNavigate: (route: AdminScreenRoute) => void;
  onSessionExpired: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  onNavigate,
  onSessionExpired,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    attendanceApi
      .getDashboard()
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: Error & { status?: number }) => {
        if (!active) return;
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        setError(err.message || 'Unable to load dashboard summary.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onSessionExpired]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-2xl bg-white border border-[#E2E8F0] p-5 animate-pulse"
            >
              <div className="h-3 w-32 bg-[#E2E8F0] rounded" />
              <div className="h-8 w-16 bg-[#E2E8F0] rounded mt-4" />
            </div>
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#991B1B]">
        {error || 'Dashboard unavailable.'}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Registered Employees',
      value: data.summary.totalRegistered,
      sub: 'Sample roster + enrolled profiles',
      icon: Users,
      accent: 'text-[#111827] bg-[#F1F5F9]',
    },
    {
      label: 'Active Employees',
      value: data.summary.activeEmployees,
      sub: 'Permitted to scan attendance',
      icon: UserCheck,
      accent: 'text-[#16A34A] bg-[#DCFCE7]',
    },
    {
      label: 'Currently Checked In',
      value: data.summary.currentlyCheckedIn,
      sub: 'Latest daily event is IN',
      icon: CheckCircle2,
      accent: 'text-[#2563EB] bg-[#EFF6FF]',
    },
    {
      label: 'Attendance Events Today',
      value: data.summary.eventsToday,
      sub: 'Validated IN & OUT events',
      icon: CalendarCheck,
      accent: 'text-[#0F766E] bg-[#CCFBF1]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Administrator Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Company-wide attendance overview and recent check-in/check-out activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(AdminScreenRoute.REGISTER_EMPLOYEE)}
          className="min-h-[46px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Employee</span>
        </button>
      </div>

      {/* Enrollment & Live Matching Notice */}
      <div className="px-4 py-3 rounded-xl bg-white border border-[#E2E8F0] flex items-center gap-2.5 text-xs text-[#475569]">
        <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
        <span>
          <strong>Live Facial Matching Active:</strong> Sample directory records have no pre-enrolled biometrics and will never auto-match. Register an employee (or click <strong>Enroll Face</strong> in Employee Directory) using a live camera to enable scanner recognition.
        </span>
      </div>

      {/* 4 Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-[#475569]">{card.label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-[#111827] font-mono tabular-nums-strict">
                  {card.value}
                </div>
                <div className="text-xs text-[#64748B] mt-1">{card.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Recent Attendance Table */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="p-5 sm:px-6 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Recent Attendance</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Latest company-wide facial recognition check-in and check-out events
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(AdminScreenRoute.ATTENDANCE_HISTORY)}
            className="min-h-[42px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>View All Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Employee ID
                </th>
                <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Employee Name
                </th>
                <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Date
                </th>
                <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Time
                </th>
                <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569] text-right">
                  Event Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {data.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#64748B]">
                    No attendance events recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#111827] tabular-nums-strict">
                      {ev.employeeId}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-[#111827]">
                      {ev.employeeName}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-[#475569] tabular-nums-strict">
                      {ev.isoTimestamp ? formatRealDate(ev.isoTimestamp) : ev.date}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-[#111827] tabular-nums-strict">
                      {ev.isoTimestamp ? formatRealTime(ev.isoTimestamp) : ev.time}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <EventStatusBadge type={ev.eventType} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {data.recentEvents.map((ev) => (
            <div key={ev.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#111827]">{ev.employeeName}</p>
                <p className="text-xs font-mono text-[#64748B] mt-0.5 tabular-nums-strict">
                  {ev.employeeId} ·{' '}
                  {ev.isoTimestamp ? formatRealDate(ev.isoTimestamp) : ev.date} ·{' '}
                  {ev.isoTimestamp ? formatRealTime(ev.isoTimestamp) : ev.time}
                </p>
              </div>
              <EventStatusBadge type={ev.eventType} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
