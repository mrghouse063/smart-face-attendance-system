import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import { AttendanceHistoryRecord } from '../../types/attendance';
import { formatRealTime } from '../../utils/dateTime';
import { EventStatusBadge } from '../StatusBadge';

interface AttendanceHistoryScreenProps {
  onSessionExpired: () => void;
}

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryScreenProps> = ({
  onSessionExpired,
}) => {
  // Draft Filter Inputs
  const [queryInput, setQueryInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [eventTypeInput, setEventTypeInput] = useState<'All' | 'IN' | 'OUT'>('All');

  // Applied Filters
  const [appliedFilters, setAppliedFilters] = useState({
    query: '',
    startDate: '',
    endDate: '',
    eventType: 'All',
  });
  const [page, setPage] = useState(1);

  const [records, setRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [allFilteredForExport, setAllFilteredForExport] = useState<
    AttendanceHistoryRecord[]
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 6,
    totalRecords: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getAttendanceHistory({
        query: appliedFilters.query,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        eventType: appliedFilters.eventType,
        page,
        pageSize: 6,
      });
      setRecords(res.records);
      setAllFilteredForExport(res.allFilteredRecords);
      setPagination(res.pagination);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      if (apiErr.status === 401) {
        onSessionExpired();
      }
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, onSessionExpired]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({
      query: queryInput.trim(),
      startDate: startDateInput,
      endDate: endDateInput,
      eventType: eventTypeInput,
    });
  };

  const handleResetFilters = () => {
    setQueryInput('');
    setStartDateInput('');
    setEndDateInput('');
    setEventTypeInput('All');
    setPage(1);
    setAppliedFilters({
      query: '',
      startDate: '',
      endDate: '',
      eventType: 'All',
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Date',
      'Check-In Time',
      'Check-Out Time',
      'Latest Event Status',
    ];
    const rows = allFilteredForExport.map((rec) => [
      rec.employeeId,
      `"${rec.employeeName}"`,
      rec.date,
      rec.checkInIso
        ? formatRealTime(rec.checkInIso)
        : rec.checkInTime || 'Not Checked In',
      rec.checkOutIso
        ? formatRealTime(rec.checkOutIso)
        : rec.checkOutTime || 'Not Checked Out',
      rec.latestStatus,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `company-attendance-history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Company Attendance History</h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Administrator-only audit view of employee check-in and check-out records.
          </p>
        </div>

        <button
          type="button"
          disabled={allFilteredForExport.length === 0}
          onClick={handleExportCsv}
          className="min-h-[46px] px-4 rounded-xl bg-[#111827] hover:bg-[#1E293B] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters Card */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label htmlFor="hist-query" className="block text-xs font-semibold text-[#111827] mb-1">
              Employee ID or Name
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="hist-query"
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="e.g., EMP001 or Mohammed"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hist-start" className="block text-xs font-semibold text-[#111827] mb-1">
              Start Date
            </label>
            <input
              id="hist-start"
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-white border border-[#CBD5E1] font-mono text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label htmlFor="hist-end" className="block text-xs font-semibold text-[#111827] mb-1">
              End Date
            </label>
            <input
              id="hist-end"
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-white border border-[#CBD5E1] font-mono text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label htmlFor="hist-type" className="block text-xs font-semibold text-[#111827] mb-1">
              Event Type
            </label>
            <select
              id="hist-type"
              value={eventTypeInput}
              onChange={(e) => setEventTypeInput(e.target.value as 'All' | 'IN' | 'OUT')}
              className="w-full h-11 px-3 rounded-xl bg-white border border-[#CBD5E1] text-sm font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="All">All</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={handleResetFilters}
            className="min-h-[44px] px-4 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>

          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Attendance Records Table & Pagination */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-base font-bold text-[#111827]">
              No attendance records match the selected filters
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Reset filters or broaden your date range to view attendance logs.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Employee ID
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Employee Name
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Date
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Check-In Time
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569]">
                      Check-Out Time
                    </th>
                    <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-[#475569] text-right">
                      Latest Event Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {records.map((rec) => (
                    <tr key={rec.key} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#111827] tabular-nums-strict">
                        {rec.employeeId}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-[#111827]">
                        {rec.employeeName}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#475569] tabular-nums-strict">
                        {rec.date}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#111827] tabular-nums-strict">
                        {rec.checkInIso
                          ? formatRealTime(rec.checkInIso)
                          : rec.checkInTime || '—'}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#64748B] tabular-nums-strict">
                        {rec.checkOutIso
                          ? formatRealTime(rec.checkOutIso)
                          : rec.checkOutTime || 'Not Checked Out'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <EventStatusBadge type={rec.latestStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {records.map((rec) => (
                <div key={rec.key} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#111827]">{rec.employeeName}</p>
                      <p className="text-xs font-mono text-[#64748B] tabular-nums-strict">
                        {rec.employeeId} · {rec.date}
                      </p>
                    </div>
                    <EventStatusBadge type={rec.latestStatus} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-lg bg-[#F8FAFC]">
                      <span className="text-[#64748B] block">Check-In</span>
                      <span className="font-mono font-semibold text-[#111827] tabular-nums-strict">
                        {rec.checkInIso
                          ? formatRealTime(rec.checkInIso)
                          : rec.checkInTime || '—'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F8FAFC]">
                      <span className="text-[#64748B] block">Check-Out</span>
                      <span className="font-mono font-semibold text-[#475569] tabular-nums-strict">
                        {rec.checkOutIso
                          ? formatRealTime(rec.checkOutIso)
                          : rec.checkOutTime || 'Not Checked Out'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="p-4 sm:px-6 border-t border-[#E2E8F0] flex items-center justify-between gap-4 text-xs text-[#475569]">
              <span className="tabular-nums-strict">
                Showing page <strong>{pagination.page}</strong> of{' '}
                <strong>{pagination.totalPages}</strong> ({pagination.totalRecords} total records)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[38px] px-3 rounded-lg border border-[#CBD5E1] disabled:opacity-45 hover:bg-[#F8FAFC] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  className="min-h-[38px] px-3 rounded-lg border border-[#CBD5E1] disabled:opacity-45 hover:bg-[#F8FAFC] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
