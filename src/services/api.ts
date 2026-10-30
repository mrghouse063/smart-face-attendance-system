import {
  AttendanceConfirmationPayload,
  AttendanceHistoryRecord,
  DashboardData,
  EmployeeDirectoryItem,
  VerifiedEmployeePayload,
} from '../types/attendance';
import { getBrowserTimeZone } from '../utils/dateTime';

const ADMIN_TOKEN_STORAGE_KEY = 'smart_attendance_admin_token';

export function getStoredAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Request failed') as Error & {
      code?: string;
      detail?: string;
      status?: number;
    };
    err.code = data.code;
    err.detail = data.detail;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function baseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Client-Timezone': getBrowserTimeZone(),
  };
}

function authHeaders(): HeadersInit {
  const token = getStoredAdminToken();
  const headers = baseHeaders();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export const attendanceApi = {
  // Genuine facial recognition: sends ONLY a real 128-D numeric descriptor extracted from live video
  async recognizeFace(descriptor: number[]): Promise<VerifiedEmployeePayload> {
    const res = await fetch('/api/attendance/recognize', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        descriptor,
        clientTimeZone: getBrowserTimeZone(),
      }),
    });
    return parseJson(res);
  },

  async recordPunch(params: {
    verificationToken: string;
    action: 'IN' | 'OUT';
  }): Promise<AttendanceConfirmationPayload> {
    const res = await fetch('/api/attendance/punch', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        ...params,
        clientTimeZone: getBrowserTimeZone(),
      }),
    });
    return parseJson(res);
  },

  async adminLogin(
    email: string,
    password: string
  ): Promise<{
    token: string;
    admin: { email: string; name: string };
  }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ email, password }),
    });
    return parseJson(res);
  },

  async adminLogout(): Promise<void> {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: authHeaders(),
    });
    setStoredAdminToken(null);
  },

  async checkAdminSession(): Promise<{
    authenticated: boolean;
    admin: { email: string; name: string };
  }> {
    const res = await fetch('/api/admin/session', {
      headers: authHeaders(),
    });
    return parseJson(res);
  },

  async getDashboard(): Promise<DashboardData> {
    const res = await fetch('/api/admin/dashboard', {
      headers: authHeaders(),
    });
    return parseJson(res);
  },

  async getEmployees(params: {
    search?: string;
    status?: string;
  }): Promise<{ employees: EmployeeDirectoryItem[] }> {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    const res = await fetch(`/api/admin/employees?${qs.toString()}`, {
      headers: authHeaders(),
    });
    return parseJson(res);
  },

  async registerEmployee(params: {
    employeeId: string;
    fullName: string;
    accountStatus: 'Active' | 'Inactive';
    descriptors: number[][];
  }): Promise<{ registered: boolean; employee: EmployeeDirectoryItem }> {
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    return parseJson(res);
  },

  async updateEmployeeStatus(
    employeeId: string,
    accountStatus: 'Active' | 'Inactive'
  ): Promise<{ updated: boolean; employee: EmployeeDirectoryItem }> {
    const res = await fetch(
      `/api/admin/employees/${encodeURIComponent(employeeId)}/status`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ accountStatus }),
      }
    );
    return parseJson(res);
  },

  async updateFacialEnrollment(
    employeeId: string,
    descriptors: number[][]
  ): Promise<{ updated: boolean; employee: EmployeeDirectoryItem }> {
    const res = await fetch(
      `/api/admin/employees/${encodeURIComponent(employeeId)}/enrollment`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ descriptors }),
      }
    );
    return parseJson(res);
  },

  async deleteEmployee(
    employeeId: string,
    removeHistory = true
  ): Promise<{
    deleted: boolean;
    employeeId: string;
    employeeName: string;
    removedEventsCount: number;
  }> {
    const res = await fetch(
      `/api/admin/employees/${encodeURIComponent(employeeId)}?removeHistory=${removeHistory}`,
      {
        method: 'DELETE',
        headers: authHeaders(),
      }
    );
    return parseJson(res);
  },

  async getAttendanceHistory(params: {
    query?: string;
    startDate?: string;
    endDate?: string;
    eventType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    records: AttendanceHistoryRecord[];
    allFilteredRecords: AttendanceHistoryRecord[];
    pagination: {
      page: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
    };
  }> {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    if (params.eventType) qs.set('eventType', params.eventType);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const res = await fetch(`/api/admin/attendance?${qs.toString()}`, {
      headers: authHeaders(),
    });
    return parseJson(res);
  },
};
