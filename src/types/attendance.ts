export enum AppInterfaceMode {
  EMPLOYEE = 'EMPLOYEE',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_PANEL = 'ADMIN_PANEL',
}

export enum ScannerWorkflowStage {
  IDLE = 'IDLE', // 1. Initial neutral state: camera off, "Start Face Scan" button
  CAMERA_ACTIVATION = 'CAMERA_ACTIVATION', // 2. Requesting device camera & loading models
  WAITING_FOR_FACE = 'WAITING_FOR_FACE', // 3a. Live camera active, waiting until real face detected
  VERIFYING_IDENTITY = 'VERIFYING_IDENTITY', // 3b. "Face detected. Verifying identity..."
  VERIFIED_IDENTITY = 'VERIFIED_IDENTITY', // 4. Genuine match succeeded -> Name, ID, CHECK IN / CHECK OUT
  FACE_NOT_RECOGNIZED = 'FACE_NOT_RECOGNIZED', // 5. Failed recognition -> "Face Not Recognized"
  CAMERA_OR_SERVICE_ERROR = 'CAMERA_OR_SERVICE_ERROR', // 6. Camera / model / service error
  CHECK_IN_SUCCESS = 'CHECK_IN_SUCCESS', // Check-in recorded confirmation
  CHECK_OUT_SUCCESS = 'CHECK_OUT_SUCCESS', // Check-out recorded confirmation
}

export enum AdminScreenRoute {
  DASHBOARD = 'DASHBOARD',
  REGISTER_EMPLOYEE = 'REGISTER_EMPLOYEE',
  EMPLOYEE_DIRECTORY = 'EMPLOYEE_DIRECTORY',
  ATTENDANCE_HISTORY = 'ATTENDANCE_HISTORY',
}

export enum FacialEnrollmentState {
  WAITING_FOR_CAMERA = 'WAITING_FOR_CAMERA',
  ACTIVATING_CAMERA = 'ACTIVATING_CAMERA',
  CAMERA_ACTIVE_NO_FACE = 'CAMERA_ACTIVE_NO_FACE',
  FACE_DETECTED = 'FACE_DETECTED',
  CAPTURING_SAMPLES = 'CAPTURING_SAMPLES',
  PROCESSING_DATA = 'PROCESSING_DATA',
  ENROLLMENT_SUCCESS = 'ENROLLMENT_SUCCESS',
  ENROLLMENT_FAILED = 'ENROLLMENT_FAILED',
}

export interface VerifiedEmployeePayload {
  verified: boolean;
  verificationToken: string;
  employee: {
    employeeId: string;
    fullName: string;
    avatarColor: string;
  };
  todayState: {
    hasCheckedInToday: boolean;
    currentlyCheckedIn: boolean;
  };
}

export interface AttendanceConfirmationPayload {
  recorded: boolean;
  eventType: 'IN' | 'OUT';
  employeeName: string;
  employeeId: string;
  date: string;
  recordedTime: string;
  isoTimestamp: string;
  todayAttendance: {
    checkIn: string;
    checkOut: string;
    checkInIso: string | null;
    checkOutIso: string | null;
  };
}

export interface EmployeeDirectoryItem {
  employeeId: string;
  fullName: string;
  accountStatus: 'Active' | 'Inactive';
  facialEnrollmentStatus: 'Completed' | 'Pending';
  enrolledSampleCount: number;
  registrationDate: string;
  lastEnrollmentAt: string | null;
  avatarColor: string;
}

export interface RecentAttendanceEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  time: string;
  isoTimestamp: string;
  eventType: 'IN' | 'OUT';
}

export interface DashboardData {
  summary: {
    totalRegistered: number;
    activeEmployees: number;
    currentlyCheckedIn: number;
    eventsToday: number;
  };
  recentEvents: RecentAttendanceEvent[];
}

export interface AttendanceHistoryRecord {
  key: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInIso: string | null;
  checkOutIso: string | null;
  latestStatus: 'IN' | 'OUT';
}
