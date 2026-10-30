import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

interface StoredEmployee {
  employeeId: string;
  fullName: string;
  accountStatus: 'Active' | 'Inactive';
  facialEnrollmentStatus: 'Completed' | 'Pending';
  enrolledDescriptors: number[][]; // Real 128-D facial embeddings from camera enrollment
  registrationDate: string;
  lastEnrollmentAt: string | null;
  avatarColor: string;
}

interface StoredAttendanceEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  time: string;
  isoTimestamp: string;
  eventType: 'IN' | 'OUT';
}

interface DatabaseSchema {
  employees: StoredEmployee[];
  attendanceEvents: StoredAttendanceEvent[];
}

interface VerificationSession {
  token: string;
  employeeId: string;
  expiresAt: number;
}

interface AdminSession {
  token: string;
  email: string;
  name: string;
  expiresAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'attendance-v2-db.json');
const MODELS_DIR = path.resolve(
  process.cwd(),
  'node_modules/@vladmandic/face-api/model'
);

// Strict L2 Euclidean distance threshold for 128-D ResNet-34 face embeddings
const FACE_MATCH_DISTANCE_THRESHOLD = 0.48;

const ADMIN_ACCOUNT = {
  email: 'admin@smartattendance.io',
  passwordHash: crypto.createHash('sha256').update('Admin@2026').digest('hex'),
  name: 'System Administrator',
};

const adminSessions = new Map<string, AdminSession>();
const verificationSessions = new Map<string, VerificationSession>();
const recentPunchLocks = new Map<string, number>();

const LEGACY_SEED_EVENT_IDS = new Set([
  'att_201',
  'att_202',
  'att_203',
  'att_204',
]);

function normalizeTimeZone(tz?: unknown): string {
  if (typeof tz === 'string' && tz.trim()) {
    const candidate = tz.trim();
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate });
      return candidate;
    } catch {
      // Invalid IANA timezone string, fall back safely
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function resolveClientTimeZone(req: Request): string {
  const headerTz = req.headers['x-client-timezone'];
  const rawHeader = Array.isArray(headerTz) ? headerTz[0] : headerTz;
  const bodyTz =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>).clientTimeZone
      : undefined;
  return normalizeTimeZone(rawHeader || bodyTz);
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? String(date.getUTCFullYear());
  const month =
    parts.find((p) => p.type === 'month')?.value ??
    String(date.getUTCMonth() + 1).padStart(2, '0');
  const day =
    parts.find((p) => p.type === 'day')?.value ??
    String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatTimeInTimeZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getTodayDateString(timeZone = 'UTC'): string {
  return formatDateInTimeZone(new Date(), normalizeTimeZone(timeZone));
}

function getPastDateString(daysAgo: number, timeZone = 'UTC'): string {
  const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return formatDateInTimeZone(dt, normalizeTimeZone(timeZone));
}

function localizeAttendanceEvent(
  ev: StoredAttendanceEvent,
  timeZone: string
): StoredAttendanceEvent {
  const parsed = new Date(ev.isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return ev;
  }
  return {
    ...ev,
    date: formatDateInTimeZone(parsed, timeZone),
    time: formatTimeInTimeZone(parsed, timeZone),
  };
}

function isValidDescriptor(vec: unknown): vec is number[] {
  return (
    Array.isArray(vec) &&
    vec.length === 128 &&
    vec.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function createInitialSeed(): DatabaseSchema {
  const today = getTodayDateString();
  const yesterday = getPastDateString(1);
  const twoDaysAgo = getPastDateString(2);

  // Sample administrative directory records start with Pending facial enrollment
  // (enrolledDescriptors: []) so NO hardcoded employee can ever falsely match a camera scan
  // until an administrator genuinely enrolls their real face via camera.
  return {
    employees: [
      {
        employeeId: 'EMP001',
        fullName: 'Sarah Al-Farsi',
        accountStatus: 'Active',
        facialEnrollmentStatus: 'Pending',
        enrolledDescriptors: [],
        registrationDate: twoDaysAgo,
        lastEnrollmentAt: null,
        avatarColor: '#2563EB',
      },
      {
        employeeId: 'EMP002',
        fullName: 'Daniel Okafor',
        accountStatus: 'Active',
        facialEnrollmentStatus: 'Pending',
        enrolledDescriptors: [],
        registrationDate: twoDaysAgo,
        lastEnrollmentAt: null,
        avatarColor: '#0F766E',
      },
      {
        employeeId: 'EMP003',
        fullName: 'Mei-Ling Chen',
        accountStatus: 'Active',
        facialEnrollmentStatus: 'Pending',
        enrolledDescriptors: [],
        registrationDate: yesterday,
        lastEnrollmentAt: null,
        avatarColor: '#4338CA',
      },
      {
        employeeId: 'EMP004',
        fullName: 'Hannah Lindholm',
        accountStatus: 'Inactive',
        facialEnrollmentStatus: 'Pending',
        enrolledDescriptors: [],
        registrationDate: twoDaysAgo,
        lastEnrollmentAt: null,
        avatarColor: '#64748B',
      },
    ],
    // No fake or random seed attendance events — only genuine real-time check-ins/check-outs are stored
    attendanceEvents: [],
  };
}

function loadDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initial = createInitialSeed();
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;

    // Strip any legacy hardcoded fake seed attendance events so random times never appear
    if (Array.isArray(parsed.attendanceEvents)) {
      const cleanedEvents = parsed.attendanceEvents.filter(
        (ev) => !LEGACY_SEED_EVENT_IDS.has(ev.id)
      );
      if (cleanedEvents.length !== parsed.attendanceEvents.length) {
        parsed.attendanceEvents = cleanedEvents;
        saveDb(parsed);
      }
    } else {
      parsed.attendanceEvents = [];
    }

    return parsed;
  } catch {
    return createInitialSeed();
  }
}

function saveDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function getEmployeeTodaySummary(
  db: DatabaseSchema,
  employeeId: string,
  dateStr: string,
  timeZone: string
) {
  const dayEvents = db.attendanceEvents
    .map((ev) => localizeAttendanceEvent(ev, timeZone))
    .filter((e) => e.employeeId === employeeId && e.date === dateStr)
    .sort((a, b) => a.isoTimestamp.localeCompare(b.isoTimestamp));

  const checkInEvents = dayEvents.filter((e) => e.eventType === 'IN');
  const checkOutEvents = dayEvents.filter((e) => e.eventType === 'OUT');
  const latestEvent = dayEvents.length > 0 ? dayEvents[dayEvents.length - 1] : null;
  const latestCheckInEvent =
    checkInEvents.length > 0 ? checkInEvents[checkInEvents.length - 1] : null;
  const latestCheckOutEvent =
    checkOutEvents.length > 0 ? checkOutEvents[checkOutEvents.length - 1] : null;

  return {
    firstCheckIn: checkInEvents.length > 0 ? checkInEvents[0].time : null,
    latestCheckIn: latestCheckInEvent ? latestCheckInEvent.time : null,
    latestCheckOut: latestCheckOutEvent ? latestCheckOutEvent.time : null,
    latestCheckInIso: latestCheckInEvent ? latestCheckInEvent.isoTimestamp : null,
    latestCheckOutIso: latestCheckOutEvent ? latestCheckOutEvent.isoTimestamp : null,
    latestStatus: latestEvent ? latestEvent.eventType : null,
  };
}

function sanitizeEmployeeForAdmin(emp: StoredEmployee) {
  return {
    employeeId: emp.employeeId,
    fullName: emp.fullName,
    accountStatus: emp.accountStatus,
    facialEnrollmentStatus: emp.facialEnrollmentStatus,
    enrolledSampleCount: emp.enrolledDescriptors.length,
    registrationDate: emp.registrationDate,
    lastEnrollmentAt: emp.lastEnrollmentAt,
    avatarColor: emp.avatarColor,
  };
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }

  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    res.status(401).json({
      error: 'Session expired or unauthorized. Please sign in again.',
    });
    return;
  }

  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Serve local @vladmandic/face-api neural network weight files
  if (fs.existsSync(MODELS_DIR)) {
    app.use('/models', express.static(MODELS_DIR));
  }

  // =========================================================================
  // PUBLIC / EMPLOYEE ATTENDANCE ENDPOINTS (STRICT PRIVACY & GENUINE MATCHING)
  // =========================================================================

  // Genuine 128-D Facial Descriptor Matching Endpoint (NO hardcoded or default fallbacks)
  app.post('/api/attendance/recognize', (req: Request, res: Response) => {
    const { descriptor } = req.body as { descriptor?: unknown };

    if (!isValidDescriptor(descriptor)) {
      res.status(400).json({
        code: 'INVALID_DESCRIPTOR',
        message: 'Recognition Service Error',
        detail:
          'A valid 128-dimensional facial embedding from an active camera scan is required.',
      });
      return;
    }

    const db = loadDb();

    // Find closest match across ALL enrolled employees (including inactive to give accurate status error if inactive)
    let bestEmployee: StoredEmployee | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const emp of db.employees) {
      if (
        emp.facialEnrollmentStatus !== 'Completed' ||
        !Array.isArray(emp.enrolledDescriptors) ||
        emp.enrolledDescriptors.length === 0
      ) {
        continue;
      }

      for (const storedVec of emp.enrolledDescriptors) {
        if (!isValidDescriptor(storedVec)) continue;
        const dist = euclideanDistance(descriptor, storedVec);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestEmployee = emp;
        }
      }
    }

    if (!bestEmployee || bestDistance > FACE_MATCH_DISTANCE_THRESHOLD) {
      res.status(404).json({
        code: 'FACE_NOT_MATCHED',
        message: 'Face Not Recognized',
        detail: 'Your face does not match any registered employee.',
      });
      return;
    }

    if (bestEmployee.accountStatus !== 'Active') {
      res.status(403).json({
        code: 'EMPLOYEE_INACTIVE',
        message: 'Face Not Recognized',
        detail:
          'This employee profile is currently deactivated and cannot record attendance. Please contact your administrator.',
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    verificationSessions.set(token, {
      token,
      employeeId: bestEmployee.employeeId,
      expiresAt: Date.now() + 3 * 60 * 1000,
    });

    const clientTimeZone = resolveClientTimeZone(req);
    const today = getTodayDateString(clientTimeZone);
    const todaySummary = getEmployeeTodaySummary(
      db,
      bestEmployee.employeeId,
      today,
      clientTimeZone
    );

    // Return ONLY the genuinely matched employee's identity
    res.json({
      verified: true,
      verificationToken: token,
      employee: {
        employeeId: bestEmployee.employeeId,
        fullName: bestEmployee.fullName,
        avatarColor: bestEmployee.avatarColor,
      },
      todayState: {
        hasCheckedInToday: Boolean(todaySummary.latestCheckIn),
        currentlyCheckedIn: todaySummary.latestStatus === 'IN',
      },
    });
  });

  // Validated Check-In / Check-Out Action
  app.post('/api/attendance/punch', (req: Request, res: Response) => {
    const { verificationToken, action } = req.body as {
      verificationToken?: string;
      action?: 'IN' | 'OUT';
    };

    if (!verificationToken || (action !== 'IN' && action !== 'OUT')) {
      res.status(400).json({
        error: 'Valid facial verification session and attendance action are required.',
      });
      return;
    }

    const session = verificationSessions.get(verificationToken);
    if (!session || session.expiresAt < Date.now()) {
      verificationSessions.delete(verificationToken);
      res.status(401).json({
        error: 'Facial verification session expired. Please scan your face again.',
      });
      return;
    }

    const db = loadDb();
    const employee = db.employees.find((e) => e.employeeId === session.employeeId);

    if (!employee || employee.accountStatus !== 'Active') {
      verificationSessions.delete(verificationToken);
      res.status(403).json({
        error: 'Employee account is unavailable or inactive.',
      });
      return;
    }

    const lockKey = `${employee.employeeId}:${action}`;
    const lastPunchAt = recentPunchLocks.get(lockKey) || 0;
    if (Date.now() - lastPunchAt < 8000) {
      res.status(409).json({
        error: 'Duplicate submission prevented. Your attendance event was just recorded.',
      });
      return;
    }

    const clientTimeZone = resolveClientTimeZone(req);
    const now = new Date();
    const today = formatDateInTimeZone(now, clientTimeZone);
    const summaryBefore = getEmployeeTodaySummary(
      db,
      employee.employeeId,
      today,
      clientTimeZone
    );

    if (action === 'OUT' && summaryBefore.latestStatus !== 'IN') {
      if (!summaryBefore.firstCheckIn) {
        res.status(400).json({
          error:
            'Cannot Check Out: You do not have a check-in record for today. Please select CHECK IN first.',
        });
        return;
      }
      res.status(400).json({
        error:
          'Cannot Check Out: You have already checked out after your last check-in today.',
      });
      return;
    }

    if (action === 'IN' && summaryBefore.latestStatus === 'IN') {
      res.status(400).json({
        error: `Already Checked In today at ${summaryBefore.latestCheckIn}. Select CHECK OUT when leaving.`,
      });
      return;
    }

    const realLocalTime = formatTimeInTimeZone(now, clientTimeZone);
    const isoNow = now.toISOString();
    const newEvent: StoredAttendanceEvent = {
      id: `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      date: today,
      time: realLocalTime,
      isoTimestamp: isoNow,
      eventType: action,
    };

    db.attendanceEvents.unshift(newEvent);
    saveDb(db);

    recentPunchLocks.set(lockKey, Date.now());
    verificationSessions.delete(verificationToken);

    const summaryAfter = getEmployeeTodaySummary(
      db,
      employee.employeeId,
      today,
      clientTimeZone
    );

    res.json({
      recorded: true,
      eventType: action,
      employeeName: employee.fullName,
      employeeId: employee.employeeId,
      date: today,
      recordedTime: realLocalTime,
      isoTimestamp: isoNow,
      todayAttendance: {
        checkIn: summaryAfter.latestCheckIn || 'Not Checked In',
        checkOut:
          action === 'IN'
            ? 'Not Checked Out'
            : summaryAfter.latestCheckOut || 'Not Checked Out',
        checkInIso: summaryAfter.latestCheckInIso,
        checkOutIso: action === 'IN' ? null : summaryAfter.latestCheckOutIso,
      },
    });
  });

  // =========================================================================
  // ADMINISTRATOR AUTHENTICATION & PROTECTED MANAGEMENT ENDPOINTS
  // =========================================================================

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Both email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (
      normalizedEmail !== ADMIN_ACCOUNT.email ||
      passwordHash !== ADMIN_ACCOUNT.passwordHash
    ) {
      res.status(401).json({
        error: 'Invalid administrator email or password. Authorized administrators only.',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      token,
      email: ADMIN_ACCOUNT.email,
      name: ADMIN_ACCOUNT.name,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
    adminSessions.set(token, session);

    res.json({
      token,
      admin: {
        email: session.email,
        name: session.name,
      },
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      adminSessions.delete(token);
    }
    res.json({ loggedOut: true });
  });

  app.get('/api/admin/session', requireAdminAuth, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.slice(7).trim();
    const session = adminSessions.get(token)!;
    res.json({
      authenticated: true,
      admin: {
        email: session.email,
        name: session.name,
      },
    });
  });

  app.get('/api/admin/dashboard', requireAdminAuth, (req: Request, res: Response) => {
    const db = loadDb();
    const clientTimeZone = resolveClientTimeZone(req);
    const today = getTodayDateString(clientTimeZone);

    const totalRegistered = db.employees.length;
    const activeEmployees = db.employees.filter((e) => e.accountStatus === 'Active').length;

    let currentlyCheckedIn = 0;
    for (const emp of db.employees) {
      const summary = getEmployeeTodaySummary(
        db,
        emp.employeeId,
        today,
        clientTimeZone
      );
      if (summary.latestStatus === 'IN') {
        currentlyCheckedIn += 1;
      }
    }

    const localizedEvents = db.attendanceEvents.map((ev) =>
      localizeAttendanceEvent(ev, clientTimeZone)
    );

    const eventsToday = localizedEvents.filter((ev) => ev.date === today).length;
    const recentEvents = [...localizedEvents]
      .sort((a, b) => b.isoTimestamp.localeCompare(a.isoTimestamp))
      .slice(0, 8);

    res.json({
      summary: {
        totalRegistered,
        activeEmployees,
        currentlyCheckedIn,
        eventsToday,
      },
      recentEvents,
    });
  });

  app.get('/api/admin/employees', requireAdminAuth, (req: Request, res: Response) => {
    const db = loadDb();
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || 'All');

    const filtered = db.employees
      .filter((emp) => {
        const matchesSearch =
          !search ||
          emp.employeeId.toLowerCase().includes(search) ||
          emp.fullName.toLowerCase().includes(search);
        const matchesStatus = status === 'All' || emp.accountStatus === status;
        return matchesSearch && matchesStatus;
      })
      .map(sanitizeEmployeeForAdmin);

    res.json({ employees: filtered });
  });

  // Register Employee with Genuine Captured 128-D Descriptors
  app.post('/api/admin/employees', requireAdminAuth, (req: Request, res: Response) => {
    const { employeeId, fullName, accountStatus, descriptors } = req.body as {
      employeeId?: string;
      fullName?: string;
      accountStatus?: 'Active' | 'Inactive';
      descriptors?: unknown[];
    };

    const cleanId = (employeeId || '').trim().toUpperCase();
    const cleanName = (fullName || '').trim();

    if (!cleanId) {
      res.status(400).json({ error: 'Employee ID is required.' });
      return;
    }

    if (!cleanName) {
      res.status(400).json({ error: 'Employee Full Name is required.' });
      return;
    }

    const validDescriptors = Array.isArray(descriptors)
      ? descriptors.filter(isValidDescriptor)
      : [];

    if (validDescriptors.length < 3) {
      res.status(400).json({
        error:
          'Genuine facial enrollment from the live camera (at least 3–5 captured facial samples) is required before registering an employee.',
      });
      return;
    }

    const db = loadDb();
    const duplicate = db.employees.some(
      (e) => e.employeeId.toUpperCase() === cleanId
    );
    if (duplicate) {
      res.status(409).json({
        error: `Employee ID "${cleanId}" is already registered. Each Employee ID must be unique.`,
      });
      return;
    }

    const palette = ['#16A34A', '#2563EB', '#0F766E', '#4338CA', '#0369A1', '#B45309'];
    const clientTimeZone = resolveClientTimeZone(req);
    const today = getTodayDateString(clientTimeZone);
    const newEmployee: StoredEmployee = {
      employeeId: cleanId,
      fullName: cleanName,
      accountStatus: accountStatus === 'Inactive' ? 'Inactive' : 'Active',
      facialEnrollmentStatus: 'Completed',
      enrolledDescriptors: validDescriptors,
      registrationDate: today,
      lastEnrollmentAt: today,
      avatarColor: palette[db.employees.length % palette.length],
    };

    db.employees.unshift(newEmployee);
    saveDb(db);

    res.status(201).json({
      registered: true,
      employee: sanitizeEmployeeForAdmin(newEmployee),
    });
  });

  app.patch(
    '/api/admin/employees/:employeeId/status',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const targetId = String(req.params.employeeId || '').toUpperCase();
      const { accountStatus } = req.body as { accountStatus?: 'Active' | 'Inactive' };

      if (accountStatus !== 'Active' && accountStatus !== 'Inactive') {
        res.status(400).json({ error: 'Valid account status (Active or Inactive) required.' });
        return;
      }

      const db = loadDb();
      const emp = db.employees.find((e) => e.employeeId.toUpperCase() === targetId);
      if (!emp) {
        res.status(404).json({ error: 'Employee not found.' });
        return;
      }

      emp.accountStatus = accountStatus;
      saveDb(db);

      res.json({ updated: true, employee: sanitizeEmployeeForAdmin(emp) });
    }
  );

  app.patch(
    '/api/admin/employees/:employeeId/enrollment',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const targetId = String(req.params.employeeId || '').toUpperCase();
      const { descriptors } = req.body as { descriptors?: unknown[] };

      const validDescriptors = Array.isArray(descriptors)
        ? descriptors.filter(isValidDescriptor)
        : [];

      if (validDescriptors.length < 3) {
        res.status(400).json({
          error: 'At least 3–5 live facial descriptor samples are required to update enrollment.',
        });
        return;
      }

      const db = loadDb();
      const emp = db.employees.find((e) => e.employeeId.toUpperCase() === targetId);
      if (!emp) {
        res.status(404).json({ error: 'Employee not found.' });
        return;
      }

      const clientTimeZone = resolveClientTimeZone(req);
      emp.facialEnrollmentStatus = 'Completed';
      emp.enrolledDescriptors = validDescriptors;
      emp.lastEnrollmentAt = getTodayDateString(clientTimeZone);
      saveDb(db);

      res.json({ updated: true, employee: sanitizeEmployeeForAdmin(emp) });
    }
  );

  app.delete(
    '/api/admin/employees/:employeeId',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const targetId = String(req.params.employeeId || '').toUpperCase();
      const removeHistory = String(req.query.removeHistory ?? 'true') !== 'false';

      const db = loadDb();
      const idx = db.employees.findIndex(
        (e) => e.employeeId.toUpperCase() === targetId
      );
      if (idx === -1) {
        res.status(404).json({ error: 'Employee not found.' });
        return;
      }

      const [removedEmployee] = db.employees.splice(idx, 1);

      let removedEventsCount = 0;
      if (removeHistory) {
        const beforeCount = db.attendanceEvents.length;
        db.attendanceEvents = db.attendanceEvents.filter(
          (ev) => ev.employeeId.toUpperCase() !== targetId
        );
        removedEventsCount = beforeCount - db.attendanceEvents.length;
      }

      // Revoke any pending verification tokens or punch locks for this deleted employee
      for (const [token, session] of verificationSessions.entries()) {
        if (session.employeeId.toUpperCase() === targetId) {
          verificationSessions.delete(token);
        }
      }
      recentPunchLocks.delete(`${removedEmployee.employeeId}:IN`);
      recentPunchLocks.delete(`${removedEmployee.employeeId}:OUT`);

      saveDb(db);

      res.json({
        deleted: true,
        employeeId: removedEmployee.employeeId,
        employeeName: removedEmployee.fullName,
        removedEventsCount,
      });
    }
  );

  app.get('/api/admin/attendance', requireAdminAuth, (req: Request, res: Response) => {
    const db = loadDb();
    const clientTimeZone = resolveClientTimeZone(req);
    const query = String(req.query.query || '').trim().toLowerCase();
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const eventType = String(req.query.eventType || 'All');
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(50, parseInt(String(req.query.pageSize || '6'), 10) || 6)
    );

    const groupedMap = new Map<
      string,
      {
        key: string;
        employeeId: string;
        employeeName: string;
        date: string;
        checkInTime: string | null;
        checkOutTime: string | null;
        checkInIso: string | null;
        checkOutIso: string | null;
        latestStatus: 'IN' | 'OUT';
        latestIso: string;
      }
    >();

    const chronological = db.attendanceEvents
      .map((ev) => localizeAttendanceEvent(ev, clientTimeZone))
      .sort((a, b) => a.isoTimestamp.localeCompare(b.isoTimestamp));

    for (const ev of chronological) {
      const key = `${ev.employeeId}__${ev.date}`;
      const existing = groupedMap.get(key);
      if (!existing) {
        groupedMap.set(key, {
          key,
          employeeId: ev.employeeId,
          employeeName: ev.employeeName,
          date: ev.date,
          checkInTime: ev.eventType === 'IN' ? ev.time : null,
          checkOutTime: ev.eventType === 'OUT' ? ev.time : null,
          checkInIso: ev.eventType === 'IN' ? ev.isoTimestamp : null,
          checkOutIso: ev.eventType === 'OUT' ? ev.isoTimestamp : null,
          latestStatus: ev.eventType,
          latestIso: ev.isoTimestamp,
        });
      } else {
        if (ev.eventType === 'IN') {
          existing.checkInTime = ev.time;
          existing.checkInIso = ev.isoTimestamp;
          existing.checkOutTime = null;
          existing.checkOutIso = null;
        } else {
          existing.checkOutTime = ev.time;
          existing.checkOutIso = ev.isoTimestamp;
        }
        existing.latestStatus = ev.eventType;
        existing.latestIso = ev.isoTimestamp;
      }
    }

    const allRecords = Array.from(groupedMap.values()).sort((a, b) =>
      b.latestIso.localeCompare(a.latestIso)
    );

    const filtered = allRecords.filter((rec) => {
      const matchesQuery =
        !query ||
        rec.employeeId.toLowerCase().includes(query) ||
        rec.employeeName.toLowerCase().includes(query);
      const matchesStart = !startDate || rec.date >= startDate;
      const matchesEnd = !endDate || rec.date <= endDate;
      const matchesType = eventType === 'All' || rec.latestStatus === eventType;
      return matchesQuery && matchesStart && matchesEnd && matchesType;
    });

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const records = filtered.slice(startIdx, startIdx + pageSize);

    res.json({
      records,
      allFilteredRecords: filtered,
      pagination: {
        page: safePage,
        pageSize,
        totalRecords,
        totalPages,
      },
    });
  });

  // Auto-clean any legacy dev-sw.js service worker cached from earlier sessions
  app.get('/dev-sw.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.includes('workbox')).map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
        );
      });
    `);
  });

  const httpServer = http.createServer(app);

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProduction) {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server: httpServer,
        },
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Attendance server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
