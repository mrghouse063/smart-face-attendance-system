/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AdminDashboardScreen } from './components/admin/AdminDashboardScreen';
import { AdminLoginScreen } from './components/admin/AdminLoginScreen';
import { AdminPanelLayout } from './components/admin/AdminPanelLayout';
import { AttendanceHistoryScreen } from './components/admin/AttendanceHistoryScreen';
import { EmployeeDirectoryScreen } from './components/admin/EmployeeDirectoryScreen';
import { RegisterEmployeeScreen } from './components/admin/RegisterEmployeeScreen';
import { EmployeeAttendanceInterface } from './components/employee/EmployeeAttendanceInterface';
import { OfflineBanner } from './components/OfflineBanner';
import {
  attendanceApi,
  getStoredAdminToken,
  setStoredAdminToken,
} from './services/api';
import { AdminScreenRoute, AppInterfaceMode } from './types/attendance';

export default function App() {
  const [interfaceMode, setInterfaceMode] = useState<AppInterfaceMode>(
    AppInterfaceMode.EMPLOYEE
  );
  const [adminRoute, setAdminRoute] = useState<AdminScreenRoute>(
    AdminScreenRoute.DASHBOARD
  );
  const [adminUser, setAdminUser] = useState<{
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) return;
    attendanceApi
      .checkAdminSession()
      .then((res) => {
        if (res.authenticated) {
          setAdminUser(res.admin);
        }
      })
      .catch(() => {
        setStoredAdminToken(null);
        setAdminUser(null);
      });
  }, []);

  const handleOpenAdminArea = () => {
    if (adminUser && getStoredAdminToken()) {
      setInterfaceMode(AppInterfaceMode.ADMIN_PANEL);
    } else {
      setInterfaceMode(AppInterfaceMode.ADMIN_LOGIN);
    }
  };

  const handleAdminLoginSuccess = (admin: { email: string; name: string }) => {
    setAdminUser(admin);
    setAdminRoute(AdminScreenRoute.DASHBOARD);
    setInterfaceMode(AppInterfaceMode.ADMIN_PANEL);
  };

  const handleAdminLogout = async () => {
    try {
      await attendanceApi.adminLogout();
    } catch {
      setStoredAdminToken(null);
    }
    setAdminUser(null);
    setInterfaceMode(AppInterfaceMode.ADMIN_LOGIN);
  };

  const handleSessionExpired = useCallback(() => {
    setStoredAdminToken(null);
    setAdminUser(null);
    setInterfaceMode(AppInterfaceMode.ADMIN_LOGIN);
  }, []);

  if (interfaceMode === AppInterfaceMode.ADMIN_PANEL) {
    if (!adminUser || !getStoredAdminToken()) {
      return (
        <>
          <OfflineBanner />
          <AdminLoginScreen
            onLoginSuccess={handleAdminLoginSuccess}
            onBackToScanner={() => setInterfaceMode(AppInterfaceMode.EMPLOYEE)}
          />
        </>
      );
    }

    return (
      <>
        <OfflineBanner />
        <AdminPanelLayout
          activeRoute={adminRoute}
          adminInfo={adminUser}
          onNavigate={setAdminRoute}
          onLogout={handleAdminLogout}
          onOpenScannerStation={() => setInterfaceMode(AppInterfaceMode.EMPLOYEE)}
        >
          {adminRoute === AdminScreenRoute.DASHBOARD && (
            <AdminDashboardScreen
              onNavigate={setAdminRoute}
              onSessionExpired={handleSessionExpired}
            />
          )}

          {adminRoute === AdminScreenRoute.REGISTER_EMPLOYEE && (
            <RegisterEmployeeScreen
              onNavigate={setAdminRoute}
              onOpenScannerStation={() =>
                setInterfaceMode(AppInterfaceMode.EMPLOYEE)
              }
              onSessionExpired={handleSessionExpired}
            />
          )}

          {adminRoute === AdminScreenRoute.EMPLOYEE_DIRECTORY && (
            <EmployeeDirectoryScreen
              onNavigate={setAdminRoute}
              onSessionExpired={handleSessionExpired}
            />
          )}

          {adminRoute === AdminScreenRoute.ATTENDANCE_HISTORY && (
            <AttendanceHistoryScreen onSessionExpired={handleSessionExpired} />
          )}
        </AdminPanelLayout>
      </>
    );
  }

  if (interfaceMode === AppInterfaceMode.ADMIN_LOGIN) {
    return (
      <>
        <OfflineBanner />
        <AdminLoginScreen
          onLoginSuccess={handleAdminLoginSuccess}
          onBackToScanner={() => setInterfaceMode(AppInterfaceMode.EMPLOYEE)}
        />
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      <EmployeeAttendanceInterface onNavigateAdminLogin={handleOpenAdminArea} />
    </>
  );
}
