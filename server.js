require('dotenv').config();

const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ptw',
};

let pool;

app.use(express.json());

const ROLES = ['requester', 'supervisor', 'safety_officer', 'approver', 'admin'];
const REVIEW_ROLES = new Set(['supervisor', 'safety_officer', 'approver']);
const PERMIT_CREATORS = new Set(['requester', 'admin']);
const PERMIT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'active',
  'closed',
  'rejected',
  'cancelled',
];

const STATUS_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['active', 'cancelled'],
  active: ['closed'],
  closed: [],
  rejected: [],
  cancelled: [],
};

const BCRYPT_ROUNDS = 10;

function nowIso() {
  return new Date().toISOString();
}

function createRandomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createId() {
  return crypto.randomUUID();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function encodeJson(value) {
  return JSON.stringify(value || []);
}

function decodeJson(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

function escapeDatabaseName(databaseName) {
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('DB_NAME may only contain letters, numbers, and underscores');
  }

  return `\`${databaseName}\``;
}

async function initializeDatabase() {
  const databaseName = escapeDatabaseName(dbConfig.database);
  const setupConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  });

  await setupConnection.query(
    `CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await setupConnection.end();

  pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    namedPlaceholders: false,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      employee_id VARCHAR(20) NOT NULL UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      organization VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      token VARCHAR(128) UNIQUE,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX idx_users_token (token),
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permits (
      id CHAR(36) PRIMARY KEY,
      requested_by_id CHAR(36) NOT NULL,
      requested_by VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      start_date_time VARCHAR(40) NOT NULL,
      end_date_time VARCHAR(40) NOT NULL,
      hazards LONGTEXT NOT NULL,
      controls LONGTEXT NOT NULL,
      ppe LONGTEXT NOT NULL,
      approvers LONGTEXT NOT NULL,
      status VARCHAR(40) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX idx_permits_requested_by_id (requested_by_id),
      INDEX idx_permits_status (status),
      CONSTRAINT fk_permits_requested_by
        FOREIGN KEY (requested_by_id) REFERENCES users(id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) PRIMARY KEY,
      permit_id CHAR(36) NOT NULL,
      occurred_at VARCHAR(40) NOT NULL,
      actor_user_id CHAR(36),
      actor_name VARCHAR(255) NOT NULL,
      actor_role VARCHAR(50),
      action VARCHAR(80) NOT NULL,
      from_status VARCHAR(40),
      to_status VARCHAR(40),
      comment TEXT,
      INDEX idx_audit_logs_permit_id (permit_id),
      CONSTRAINT fk_audit_logs_permit
        FOREIGN KEY (permit_id) REFERENCES permits(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedDemoUsers();
}

const ready = initializeDatabase();

async function ensureReady(req, res, next) {
  try {
    await ready;
    next();
  } catch (error) {
    next(error);
  }
}

function rowToUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    organization: row.organization,
    role: row.role,
    passwordHash: row.password_hash,
    token: row.token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPermit(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    requestedById: row.requested_by_id,
    requestedBy: row.requested_by,
    title: row.title,
    location: row.location,
    description: row.description,
    startDateTime: row.start_date_time,
    endDateTime: row.end_date_time,
    hazards: decodeJson(row.hazards),
    controls: decodeJson(row.controls),
    ppe: decodeJson(row.ppe),
    approvers: decodeJson(row.approvers),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAuditLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    permitId: row.permit_id,
    when: row.occurred_at,
    by: row.actor_name,
    byRole: row.actor_role,
    action: row.action,
    from: row.from_status,
    status: row.to_status,
    comment: row.comment || '',
  };
}

function sanitizeUser(user) {
  const { passwordHash, token, ...safeUser } = user;
  return safeUser;
}

async function createEmployeeId(connection = pool) {
  const [rows] = await connection.execute(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 5) AS UNSIGNED)), 10000) + 1 AS next_id
    FROM users
    WHERE employee_id LIKE 'EMP-%'
  `);

  return `EMP-${String(rows[0].next_id).padStart(5, '0')}`;
}

async function getUserByEmail(email, connection = pool) {
  const [rows] = await connection.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [
    normalizeEmail(email),
  ]);
  return rowToUser(rows[0]);
}

async function getUserByLogin(login) {
  const normalizedLogin = normalizeEmail(login);
  const [rows] = await pool.execute(
    `
    SELECT *
    FROM users
    WHERE email = ? OR lower(employee_id) = ?
    LIMIT 1
  `,
    [normalizedLogin, normalizedLogin],
  );

  return rowToUser(rows[0]);
}

async function getUserByToken(token) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE token = ? LIMIT 1', [token]);
  return rowToUser(rows[0]);
}

async function updateUserToken(userId, token) {
  await pool.execute('UPDATE users SET token = ?, updated_at = ? WHERE id = ?', [
    token,
    nowIso(),
    userId,
  ]);
}

async function insertUser({ employeeId, fullName, email, organization, role, password }, connection = pool) {
  const id = createId();
  const timestamp = nowIso();
  const resolvedEmployeeId = employeeId || (await createEmployeeId(connection));

  await connection.execute(
    `
    INSERT INTO users (
      id,
      employee_id,
      full_name,
      email,
      organization,
      role,
      password_hash,
      token,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `,
    [
      id,
      resolvedEmployeeId,
      normalizeString(fullName),
      normalizeEmail(email),
      normalizeString(organization),
      role,
      hashPassword(password),
      timestamp,
      timestamp,
    ],
  );

  const [rows] = await connection.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rowToUser(rows[0]);
}

async function seedDemoUsers() {
  const demoUsers = [
    {
      employeeId: 'EMP-10000',
      fullName: 'PTW Admin',
      email: 'admin@example.com',
      organization: 'PTW Guardian',
      role: 'admin',
      password: 'admin12345',
    },
    {
      employeeId: 'EMP-10001',
      fullName: 'Rina Requester',
      email: 'requester@example.com',
      organization: 'Global Engineering',
      role: 'requester',
      password: 'requester12345',
    },
    {
      employeeId: 'EMP-10002',
      fullName: 'Sam Supervisor',
      email: 'supervisor@example.com',
      organization: 'Operations',
      role: 'supervisor',
      password: 'supervisor12345',
    },
    {
      employeeId: 'EMP-10003',
      fullName: 'Sarah Safety',
      email: 'safety@example.com',
      organization: 'HSE',
      role: 'safety_officer',
      password: 'safety12345',
    },
    {
      employeeId: 'EMP-10004',
      fullName: 'Amir Approver',
      email: 'approver@example.com',
      organization: 'Plant Management',
      role: 'approver',
      password: 'approver12345',
    },
  ];

  for (const demoUser of demoUsers) {
    const existing = await getUserByEmail(demoUser.email);

    if (!existing) {
      await insertUser(demoUser);
    }
  }
}

async function getPermitById(id) {
  const [rows] = await pool.execute('SELECT * FROM permits WHERE id = ? LIMIT 1', [id]);
  return rowToPermit(rows[0]);
}

async function getAuditLogs(permitId, connection = pool) {
  const [rows] = await connection.execute(
    `
    SELECT *
    FROM audit_logs
    WHERE permit_id = ?
    ORDER BY occurred_at ASC
  `,
    [permitId],
  );

  return rows.map(rowToAuditLog);
}

async function insertAuditLog(
  {
    permitId,
    actorUserId,
    actorName,
    actorRole,
    action,
    fromStatus = null,
    toStatus = null,
    comment = '',
  },
  connection = pool,
) {
  const id = createId();

  await connection.execute(
    `
    INSERT INTO audit_logs (
      id,
      permit_id,
      occurred_at,
      actor_user_id,
      actor_name,
      actor_role,
      action,
      from_status,
      to_status,
      comment
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      permitId,
      nowIso(),
      actorUserId,
      actorName,
      actorRole,
      action,
      fromStatus,
      toStatus,
      comment,
    ],
  );

  const [rows] = await connection.execute('SELECT * FROM audit_logs WHERE id = ? LIMIT 1', [
    id,
  ]);
  return rowToAuditLog(rows[0]);
}

async function insertPermit(payload, user) {
  const connection = await pool.getConnection();
  const id = createId();
  const timestamp = nowIso();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
      INSERT INTO permits (
        id,
        requested_by_id,
        requested_by,
        title,
        location,
        description,
        start_date_time,
        end_date_time,
        hazards,
        controls,
        ppe,
        approvers,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `,
      [
        id,
        user.id,
        user.fullName,
        normalizeString(payload.title),
        normalizeString(payload.location),
        normalizeString(payload.description),
        normalizeString(payload.startDateTime),
        normalizeString(payload.endDateTime),
        encodeJson(normalizeArray(payload.hazards)),
        encodeJson(normalizeArray(payload.controls)),
        encodeJson(normalizeArray(payload.ppe)),
        encodeJson(normalizeArray(payload.approvers)),
        timestamp,
        timestamp,
      ],
    );

    const createdLog = await insertAuditLog(
      {
        permitId: id,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'created',
        toStatus: 'draft',
        comment: 'Permit created as draft',
      },
      connection,
    );

    await connection.commit();

    return {
      ...(await getPermitById(id)),
      auditLogs: [createdLog],
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePermitStatus(permit, nextStatus, user, comment) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute('UPDATE permits SET status = ?, updated_at = ? WHERE id = ?', [
      nextStatus,
      nowIso(),
      permit.id,
    ]);

    await insertAuditLog(
      {
        permitId: permit.id,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'status changed',
        fromStatus: permit.status,
        toStatus: nextStatus,
        comment: normalizeString(comment),
      },
      connection,
    );

    await connection.commit();

    return {
      ...(await getPermitById(permit.id)),
      auditLogs: await getAuditLogs(permit.id),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function isAdmin(user) {
  return user.role === 'admin';
}

function isReviewer(user) {
  return REVIEW_ROLES.has(user.role);
}

function canViewPermit(user, permit) {
  return isAdmin(user) || isReviewer(user) || permit.requestedById === user.id;
}

function canCreatePermit(user) {
  return PERMIT_CREATORS.has(user.role);
}

function requireRequester(req, res, next) {
  if (req.user.role !== 'requester') {
    return res.status(403).json({
      error: 'Contractor dashboard is available to requester users only',
      yourRole: req.user.role,
    });
  }

  return next();
}

function buildRequesterDashboard(user, permits) {
  const counts = PERMIT_STATUSES.reduce((summary, status) => {
    summary[status] = 0;
    return summary;
  }, {});

  permits.forEach((permit) => {
    counts[permit.status] = (counts[permit.status] || 0) + 1;
  });

  const activePermits = permits
    .filter((permit) => ['active', 'approved', 'submitted'].includes(permit.status))
    .slice(0, 5);

  return {
    user: sanitizeUser(user),
    site: 'Main Plant Alpha (Sector 4)',
    stats: {
      draftPermits: counts.draft || 0,
      pendingApproval: counts.submitted || 0,
      approvedPermits: (counts.approved || 0) + (counts.active || 0),
      expiringCertificates: 0,
      totalActivePermits: activePermits.length,
    },
    permits: activePermits,
    resources: [
      'Safety Handbook v2.4',
      'Emergency Protocols',
      'Site HSE Contact List',
    ],
  };
}

function getTransitionDecision(user, permit, nextStatus) {
  const allowedNextStatuses = STATUS_TRANSITIONS[permit.status] || [];

  if (!allowedNextStatuses.includes(nextStatus)) {
    return {
      allowed: false,
      httpStatus: 409,
      error: 'Invalid status transition',
      currentStatus: permit.status,
      allowedNextStatuses,
    };
  }

  if (isAdmin(user)) {
    return { allowed: true };
  }

  const isOwnerRequester = user.role === 'requester' && permit.requestedById === user.id;

  if (permit.status === 'draft' && ['submitted', 'cancelled'].includes(nextStatus)) {
    return isOwnerRequester
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester who created this draft can submit or cancel it',
        };
  }

  if (permit.status === 'submitted' && ['approved', 'rejected'].includes(nextStatus)) {
    return isReviewer(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only supervisor, safety officer, approver, or admin can approve or reject submitted permits',
        };
  }

  if (permit.status === 'submitted' && nextStatus === 'cancelled') {
    return isOwnerRequester
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester who created this permit or admin can cancel it',
        };
  }

  if (permit.status === 'approved' && ['active', 'cancelled'].includes(nextStatus)) {
    return isReviewer(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only supervisor, safety officer, approver, or admin can activate or cancel approved permits',
        };
  }

  if (permit.status === 'active' && nextStatus === 'closed') {
    return isOwnerRequester || isReviewer(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester, supervisor, safety officer, approver, or admin can close active permits',
        };
  }

  return {
    allowed: false,
    httpStatus: 403,
    error: 'Your role is not allowed to perform this status change',
  };
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await getUserByToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

function sendNoCacheFile(res, filePath) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(filePath);
}

async function resetForTests() {
  await ready;
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM permits');
  await pool.query('DELETE FROM users');
  await seedDemoUsers();
}

async function closeDb() {
  if (pool) {
    await pool.end();
  }
}

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/style.css', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'app.js'));
});

app.get('/dashboard.css', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'dashboard.css'));
});

app.get('/dashboard.js', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'dashboard.js'));
});

app.use(ensureReady);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ptw-backend',
    database: dbConfig.database,
    driver: 'mysql',
  });
});

app.get('/api/meta', (req, res) => {
  res.json({
    roles: ROLES,
    statuses: PERMIT_STATUSES,
    transitions: STATUS_TRANSITIONS,
  });
});

app.get(['/', '/login', '/signup'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'dashboard.html'));
});

app.post('/api/auth/signup', async (req, res) => {
  const { fullName, email, organization, role, password, acceptTerms } = req.body || {};

  if (!fullName || !email || !organization || !role || !password || !acceptTerms) {
    return res.status(400).json({ error: 'Missing required registration fields' });
  }

  if (!ROLES.includes(role)) {
    return res.status(400).json({
      error: 'Invalid role',
      allowedRoles: ROLES,
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (await getUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = await insertUser({
    fullName,
    email,
    organization,
    role,
    password,
  });
  const token = createRandomToken();
  await updateUserToken(user.id, token);

  return res.status(201).json({
    user: sanitizeUser({ ...user, token }),
    token,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login credentials' });
  }

  const user = await getUserByLogin(login);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createRandomToken();
  await updateUserToken(user.id, token);

  return res.json({
    user: sanitizeUser({ ...user, token }),
    token,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  await updateUserToken(req.user.id, null);
  res.json({ status: 'ok' });
});

app.get('/api/requester/dashboard', authenticate, requireRequester, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM permits WHERE requested_by_id = ? ORDER BY created_at DESC',
    [req.user.id],
  );
  const permits = rows.map(rowToPermit);

  res.json(buildRequesterDashboard(req.user, permits));
});

app.get('/api/permits', authenticate, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM permits ORDER BY created_at DESC');
  const visiblePermits = rows.map(rowToPermit).filter((permit) => canViewPermit(req.user, permit));

  res.json({
    count: visiblePermits.length,
    permits: visiblePermits,
    data: visiblePermits,
  });
});

app.post('/api/permits', authenticate, async (req, res) => {
  if (!canCreatePermit(req.user)) {
    return res.status(403).json({
      error: 'Only requester or admin can create permits',
      yourRole: req.user.role,
    });
  }

  const { title, location, description, startDateTime, endDateTime } = req.body || {};

  if (!title || !location || !description || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'Missing permit information' });
  }

  const permit = await insertPermit(req.body, req.user);
  return res.status(201).json(permit);
});

app.get('/api/permits/:id', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  return res.json({
    ...permit,
    auditLogs: await getAuditLogs(permit.id),
  });
});

app.patch('/api/permits/:id/status', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  const { status, comment } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  if (!PERMIT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      allowedStatuses: PERMIT_STATUSES,
    });
  }

  const decision = getTransitionDecision(req.user, permit, status);

  if (!decision.allowed) {
    return res.status(decision.httpStatus).json(decision);
  }

  const updatedPermit = await updatePermitStatus(permit, status, req.user, comment);
  return res.json(updatedPermit);
});

app.get('/api/permits/:id/audit-logs', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  const logs = await getAuditLogs(permit.id);
  return res.json({ count: logs.length, logs, data: logs });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? undefined : error.message,
  });
});

if (require.main === module) {
  ready
    .then(() => {
      app.listen(port, () => {
        console.log(`PTW backend running at http://localhost:${port}`);
        console.log(`Connected to MySQL database '${dbConfig.database}'`);
      });
    })
    .catch((error) => {
      console.error('Failed to start PTW backend.');
      console.error(error.message);
      process.exit(1);
    });
}

app.ready = ready;
app.closeDb = closeDb;
app.resetForTests = resetForTests;

module.exports = app;
