require('dotenv').config();

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const {
  buildHseEvaluation,
  extractPermitType,
  mapHseDecisionToStatus,
  normalizeAssignedWorkers,
  normalizePermitDocuments,
} = require('./hse-officer');

const app = express();
const port = process.env.PORT || 3000;
const MAX_PROFILE_PICTURE_BYTES = 10 * 1024 * 1024;
const MAX_CERTIFICATION_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_PERMIT_DOCUMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const PROFILE_PICTURE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CERTIFICATION_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const PROFILE_PICTURE_UPLOAD_DIR = path.join(__dirname, 'uploads', 'profile-pictures');
const CERTIFICATION_UPLOAD_DIR = path.join(__dirname, 'uploads', 'worker-certifications');
const PERMIT_DOCUMENT_UPLOAD_DIR = path.join(__dirname, 'uploads', 'permit-documents');
const PERMIT_DOCUMENT_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ptw',
};

let pool;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '80mb' }));

const ROLES = ['requester', 'supervisor', 'safety_officer', 'approver', 'admin', 'worker'];
const REVIEW_ROLES = new Set(['supervisor', 'safety_officer', 'approver']);
const PERMIT_CREATORS = new Set(['requester', 'admin', 'worker']);
const PERMIT_STATUSES = [
  'draft',
  'submitted',
  'stage1_complete',
  'approved',
  'active',
  'closed',
  'rejected',
  'cancelled',
];

const STATUS_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['stage1_complete', 'approved', 'rejected', 'cancelled'],
  stage1_complete: ['approved', 'rejected', 'cancelled'],
  approved: ['active', 'rejected', 'cancelled'],
  active: ['closed', 'rejected', 'cancelled'],
  closed: [],
  rejected: ['submitted', 'cancelled'],
  cancelled: [],
};

const BCRYPT_ROUNDS = 10;

function nowIso() {
  return new Date().toISOString();
}

function addMinutesToIso(value, minutes) {
  const date = new Date(value);
  const amount = Number(minutes);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(amount)) return '';
  return new Date(date.getTime() + Math.round(amount) * 60 * 1000).toISOString();
}

function createRandomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createActivationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createActivationExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function buildActivationLink(req, activationToken) {
  return `${req.protocol}://${req.get('host')}/activate?token=${encodeURIComponent(activationToken)}`;
}

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function getInviteDeliveryDisabledReason() {
  if (process.env.NODE_ENV === 'test' && !isTruthyEnv(process.env.ALLOW_INVITE_DELIVERY_IN_TESTS)) {
    return 'disabled_in_test';
  }
  return '';
}

function isSmtpConfigured() {
  return Boolean(normalizeString(process.env.SMTP_HOST) && normalizeString(process.env.SMTP_FROM));
}

function createMailTransport() {
  const authUser = normalizeString(process.env.SMTP_USER);
  const authPass = normalizeString(process.env.SMTP_PASSWORD);
  const transportConfig = {
    host: normalizeString(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT || 587),
    secure: isTruthyEnv(process.env.SMTP_SECURE),
  };

  if (authUser || authPass) {
    transportConfig.auth = {
      user: authUser,
      pass: authPass,
    };
  }

  return nodemailer.createTransport(transportConfig);
}

function buildWorkerInviteMessage({ worker, user, activationLink, activationExpiresAt }) {
  const workerName = normalizeString(worker?.name || user?.fullName || 'Worker');
  const company = normalizeString(worker?.company || user?.organization || 'your company');
  const expiresAt = activationExpiresAt
    ? new Date(activationExpiresAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    })
    : 'the expiry time shown in PTW Guardian';

  const text = [
    `Hello ${workerName},`,
    '',
    `${company} has approved your PTW Guardian worker profile.`,
    'Set your account password using this activation link:',
    activationLink,
    '',
    `This link expires on ${expiresAt}.`,
    'If you did not expect this invite, contact your PTW administrator.',
  ].join('\n');

  const html = `
    <p>Hello ${workerName},</p>
    <p>${company} has approved your PTW Guardian worker profile.</p>
    <p><a href="${activationLink}">Set your account password</a></p>
    <p>This link expires on ${expiresAt}.</p>
    <p>If you did not expect this invite, contact your PTW administrator.</p>
  `;

  const sms = `PTW Guardian: your worker profile was approved. Set your password: ${activationLink}`;

  return { subject: 'Activate your PTW Guardian worker account', text, html, sms };
}

async function sendActivationEmail({ worker, user, activationLink, activationExpiresAt }) {
  const message = buildWorkerInviteMessage({ worker, user, activationLink, activationExpiresAt });
  const transport = createMailTransport();
  await transport.sendMail({
    from: normalizeString(process.env.SMTP_FROM),
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

async function sendActivationSms({ worker, user, activationLink, activationExpiresAt }) {
  const webhookUrl = normalizeString(process.env.SMS_WEBHOOK_URL);
  const authHeader = normalizeString(process.env.SMS_WEBHOOK_AUTH);
  const message = buildWorkerInviteMessage({ worker, user, activationLink, activationExpiresAt });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        to: normalizeString(worker.phone),
        body: message.sms,
        workerName: normalizeString(worker.name),
        workerEmail: user.email,
        activationLink,
        activationExpiresAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS webhook returned ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverActivationInvite({ worker, user, activationLink, activationExpiresAt }) {
  const disabledReason = getInviteDeliveryDisabledReason();
  const channels = [];

  if (disabledReason) {
    channels.push({ channel: 'email', status: 'not_configured', reason: disabledReason });
    channels.push({ channel: 'sms', status: 'not_configured', reason: disabledReason });
    return { sent: false, channels };
  }

  if (isSmtpConfigured()) {
    try {
      await sendActivationEmail({ worker, user, activationLink, activationExpiresAt });
      channels.push({ channel: 'email', status: 'sent', to: user.email });
    } catch (error) {
      channels.push({ channel: 'email', status: 'failed', to: user.email, error: error.message });
    }
  } else {
    channels.push({ channel: 'email', status: 'not_configured', reason: 'SMTP_HOST and SMTP_FROM are required' });
  }

  const smsWebhookUrl = normalizeString(process.env.SMS_WEBHOOK_URL);
  const phone = normalizeString(worker?.phone);
  if (smsWebhookUrl && phone) {
    try {
      await sendActivationSms({ worker, user, activationLink, activationExpiresAt });
      channels.push({ channel: 'sms', status: 'sent', to: phone });
    } catch (error) {
      channels.push({ channel: 'sms', status: 'failed', to: phone, error: error.message });
    }
  } else {
    channels.push({
      channel: 'sms',
      status: smsWebhookUrl ? 'skipped' : 'not_configured',
      reason: smsWebhookUrl ? 'Worker phone is required' : 'SMS_WEBHOOK_URL is required',
    });
  }

  return {
    sent: channels.some((channel) => channel.status === 'sent'),
    channels,
  };
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

function normalizeIdentityName(value) {
  return normalizeString(value).replace(/\s+/g, ' ').toLowerCase();
}

async function validateWorkerAccountReference({ name, email }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeString(name);

  if (!normalizedEmail) {
    return { error: 'Worker email is required and must match a registered worker account', status: 400 };
  }

  const account = await getUserByEmail(normalizedEmail);
  if (!account) {
    return { error: 'Worker account must be registered before a worker profile can be submitted', status: 400 };
  }

  if (account.role !== 'worker') {
    return { error: `Email already belongs to a ${account.role} account, not a worker account`, status: 400 };
  }

  if (normalizeIdentityName(account.fullName) !== normalizeIdentityName(normalizedName)) {
    return { error: 'Worker name and email must match the registered worker account', status: 400 };
  }

  return { account };
}

function normalizePermitHazards(payload) {
  const hazards = normalizeArray(payload?.hazards);
  if (!payload?.isEmergency) {
    return hazards;
  }

  return [...new Set([...hazards.filter((hazard) => hazard !== 'Emergency'), 'Emergency'])];
}

function decodeBase64Size(base64Value) {
  const normalized = normalizeString(base64Value).replace(/\s+/g, '');
  if (!normalized) return 0;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function normalizeBase64Upload(value) {
  return normalizeString(value).replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
}

function sanitizeDownloadFilename(fileName) {
  const normalized = normalizeString(fileName).replace(/[/\\?%*:|"<>]/g, '_');
  return normalized || 'certificate';
}

function buildContentDisposition(fileName) {
  const safeName = sanitizeDownloadFilename(fileName);
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function storeCertificationAttachment(certificationId, fileName, attachmentData) {
  const safeId = sanitizeDownloadFilename(certificationId || createId());
  const extension = path.extname(sanitizeDownloadFilename(fileName)).toLowerCase();
  const storageName = `${safeId}${extension || '.bin'}`;
  const absolutePath = path.join(CERTIFICATION_UPLOAD_DIR, storageName);
  fs.mkdirSync(CERTIFICATION_UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(attachmentData, 'base64'));
  return path.relative(__dirname, absolutePath);
}

function storePermitDocumentAttachment(documentId, fileName, attachmentData) {
  const safeId = sanitizeDownloadFilename(documentId || createId());
  const extension = path.extname(sanitizeDownloadFilename(fileName)).toLowerCase();
  const storageName = `${safeId}${extension || '.bin'}`;
  const absolutePath = path.join(PERMIT_DOCUMENT_UPLOAD_DIR, storageName);
  fs.mkdirSync(PERMIT_DOCUMENT_UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(attachmentData, 'base64'));
  return path.relative(__dirname, absolutePath);
}

function getProfilePictureExtension(fileName, mimeType) {
  const extension = path.extname(sanitizeDownloadFilename(fileName)).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    return extension === '.jpeg' ? '.jpg' : extension;
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function storeProfilePicture(userId, fileName, mimeType, attachmentData) {
  const safeId = sanitizeDownloadFilename(userId || createId());
  const extension = getProfilePictureExtension(fileName, mimeType);
  const storageName = `${safeId}-${Date.now()}${extension}`;
  const absolutePath = path.join(PROFILE_PICTURE_UPLOAD_DIR, storageName);
  fs.mkdirSync(PROFILE_PICTURE_UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(attachmentData, 'base64'));
  return path.relative(__dirname, absolutePath);
}

function buildProfilePictureUrl(profilePicturePath) {
  const normalizedPath = normalizeString(profilePicturePath);
  if (!normalizedPath) return '';
  return `/${normalizedPath.replace(/\\/g, '/')}`;
}

function resolveCertificationAttachmentPath(attachmentPath) {
  const normalizedPath = normalizeString(attachmentPath);
  if (!normalizedPath) return '';

  const uploadRoot = path.resolve(CERTIFICATION_UPLOAD_DIR);
  const absolutePath = path.resolve(__dirname, normalizedPath);
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    return '';
  }
  return absolutePath;
}

function resolvePermitDocumentAttachmentPath(attachmentPath) {
  const normalizedPath = normalizeString(attachmentPath);
  if (!normalizedPath) return '';

  const uploadRoot = path.resolve(PERMIT_DOCUMENT_UPLOAD_DIR);
  const absolutePath = path.resolve(__dirname, normalizedPath);
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    return '';
  }
  return absolutePath;
}

function inferMimeTypeFromFileName(fileName) {
  const lowerName = normalizeString(fileName).toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.doc')) return 'application/msword';
  if (lowerName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  return '';
}

function isGenericUploadMimeType(mimeType) {
  return ['', 'application/octet-stream', 'binary/octet-stream'].includes(
    normalizeString(mimeType).toLowerCase(),
  );
}

function inferPermitDocumentMimeType(fileName, mimeType) {
  const normalized = normalizeString(mimeType).toLowerCase();
  const extensionMimeType = inferMimeTypeFromFileName(fileName);

  if (isGenericUploadMimeType(normalized)) {
    return extensionMimeType;
  }

  return normalized || extensionMimeType;
}

const WORKER_PERMIT_TYPES = [
  'Hot Work',
  'Confined Space',
  'Electrical Isolation',
  'Work at Height',
  'Line Breaking',
  'General Maintenance',
];

function permitTypeKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const WORKER_PERMIT_ALIASES = new Map(
  [
    ['Hot Work', 'Hot Work'],
    ['Hotwork', 'Hot Work'],
    ['Confined Space', 'Confined Space'],
    ['Confinedspace', 'Confined Space'],
    ['Electrical Isolation', 'Electrical Isolation'],
    ['Electrical', 'Electrical Isolation'],
    ['LOTO', 'Electrical Isolation'],
    ['Lockout Tagout', 'Electrical Isolation'],
    ['Work at Height', 'Work at Height'],
    ['Working at Height', 'Work at Height'],
    ['WAH', 'Work at Height'],
    ['Line Breaking', 'Line Breaking'],
    ['Line Break', 'Line Breaking'],
    ['General Maintenance', 'General Maintenance'],
    ['Maintenance', 'General Maintenance'],
  ].map(([alias, canonical]) => [permitTypeKey(alias), canonical]),
);

function normalizeWorkerPermitList(value) {
  const source = Array.isArray(value) ? value : normalizeString(value).split(',');
  const permits = [];
  const invalidPermits = [];
  const seen = new Set();

  source.forEach((item) => {
    const raw = normalizeString(item);
    if (!raw) return;

    const canonical = WORKER_PERMIT_ALIASES.get(permitTypeKey(raw));
    if (!canonical) {
      invalidPermits.push(raw);
      return;
    }

    if (seen.has(canonical)) return;
    seen.add(canonical);
    permits.push(canonical);
  });

  return { permits, invalidPermits };
}

function normalizeWorkerCertifications(value, existingCertifications = [], options = {}) {
  const source = Array.isArray(value) ? value : [];
  const existingById = new Map(
    (Array.isArray(existingCertifications) ? existingCertifications : [])
      .map((certification) => [normalizeString(certification?.id), certification])
      .filter(([id]) => id),
  );

  return source
    .map((certification) => {
      if (typeof certification === 'string') {
        return {
          id: createId(),
          type: normalizeString(certification),
          number: '',
          issuer: '',
          issueDate: '',
          expiryDate: '',
          fileName: '',
          mimeType: '',
          attachmentData: '',
          attachmentPath: '',
        };
      }

      const id = normalizeString(certification?.id) || createId();
      const existing = existingById.get(id);
      const incomingAttachmentData = normalizeString(
        certification?.attachmentData || certification?.fileData || certification?.contentBase64,
      );
      const incomingMimeType = normalizeString(
        certification?.mimeType || certification?.attachmentMimeType,
      ).toLowerCase();
      let attachmentData = incomingAttachmentData || normalizeString(existing?.attachmentData);
      let attachmentPath = incomingAttachmentData
        ? ''
        : normalizeString(existing?.attachmentPath || certification?.attachmentPath);
      const mimeType = incomingAttachmentData
        ? incomingMimeType
        : normalizeString(existing?.mimeType || certification?.mimeType || certification?.attachmentMimeType).toLowerCase();
      const fileName = normalizeString(certification?.fileName || certification?.attachmentName)
        || normalizeString(existing?.fileName);

      if (incomingAttachmentData && !CERTIFICATION_ATTACHMENT_MIME_TYPES.has(mimeType)) {
        throw new Error(`Unsupported certification file type: ${mimeType || 'unknown'}`);
      }

      if (incomingAttachmentData && decodeBase64Size(incomingAttachmentData) > MAX_CERTIFICATION_ATTACHMENT_BYTES) {
        throw new Error('Certification file exceeds 5 MB limit');
      }

      if (incomingAttachmentData && options.persistAttachments) {
        attachmentPath = storeCertificationAttachment(id, fileName, incomingAttachmentData);
        attachmentData = '';
      }

      return {
        id,
        type: normalizeString(certification?.type || certification?.name),
        number: normalizeString(certification?.number || certification?.certificateNo),
        issuer: normalizeString(certification?.issuer),
        issueDate: normalizeString(certification?.issueDate),
        expiryDate: normalizeString(certification?.expiryDate || certification?.expiry),
        fileName,
        mimeType,
        attachmentData,
        attachmentPath,
      };
    })
    .filter((certification) =>
      Object.values(certification).some((field) => normalizeString(field)),
    );
}

function serializeWorkerCertifications(certifications = [], options = {}) {
  const includeAttachmentData = Boolean(options.includeAttachmentData);

  return normalizeWorkerCertifications(certifications).map((certification) => ({
    id: certification.id,
    type: certification.type,
    number: certification.number,
    issuer: certification.issuer,
    issueDate: certification.issueDate,
    expiryDate: certification.expiryDate,
    fileName: certification.fileName,
    mimeType: certification.mimeType,
    hasAttachment: Boolean(certification.attachmentData || certification.attachmentPath),
    ...(includeAttachmentData ? { attachmentData: certification.attachmentData } : {}),
    ...(includeAttachmentData ? { attachmentPath: certification.attachmentPath } : {}),
  }));
}

function normalizePermitDocumentsForStorage(documents = [], description = '', existingDocuments = []) {
  const existingById = new Map();
  const existingByKey = new Map();

  normalizePermitDocuments(existingDocuments).forEach((document) => {
    const id = normalizeString(document.id);
    const key = `${normalizeString(document.type)}:${normalizeString(document.name).toLowerCase()}`;
    if (id) existingById.set(id, document);
    if (key !== ':') existingByKey.set(key, document);
  });

  return normalizePermitDocuments(documents, description).map((document) => {
    const key = `${normalizeString(document.type)}:${normalizeString(document.name).toLowerCase()}`;
    const existing = existingById.get(normalizeString(document.id)) || existingByKey.get(key);
    const incomingAttachmentData = normalizeString(
      document.attachmentData || document.fileData || document.contentBase64,
    );
    const fileName =
      normalizeString(document.fileName || document.filename) ||
      normalizeString(existing?.fileName) ||
      normalizeString(document.name);
    const mimeType = incomingAttachmentData
      ? inferPermitDocumentMimeType(fileName, document.mimeType || document.attachmentMimeType)
      : normalizeString(existing?.mimeType || document.mimeType || document.attachmentMimeType).toLowerCase();
    const documentId = normalizeString(document.id || existing?.id) || createId();
    let attachmentData = incomingAttachmentData || normalizeString(existing?.attachmentData);
    let attachmentPath = incomingAttachmentData
      ? ''
      : normalizeString(existing?.attachmentPath || document.attachmentPath);

    if (incomingAttachmentData && !PERMIT_DOCUMENT_ATTACHMENT_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported permit document file type: ${mimeType || 'unknown'}`);
    }

    if (incomingAttachmentData && decodeBase64Size(incomingAttachmentData) > MAX_PERMIT_DOCUMENT_ATTACHMENT_BYTES) {
      throw new Error('Permit document file exceeds 5 MB limit');
    }

    if (incomingAttachmentData) {
      attachmentPath = storePermitDocumentAttachment(documentId, fileName, incomingAttachmentData);
      attachmentData = '';
    }

    return {
      id: documentId,
      type: normalizeString(document.type),
      name: normalizeString(document.name),
      fileName,
      mimeType,
      attachmentData,
      attachmentPath,
      hasAttachment: Boolean(attachmentData || attachmentPath),
    };
  });
}

function serializePermitDocuments(documents = [], options = {}) {
  const includeAttachmentData = Boolean(options.includeAttachmentData);

  return normalizePermitDocuments(documents).map((document) => {
    const hasAttachment = Boolean(document.hasAttachment || document.attachmentData || document.attachmentPath);
    return {
      type: document.type,
      name: document.name,
      ...(hasAttachment && normalizeString(document.id) ? { id: normalizeString(document.id) } : {}),
      ...(hasAttachment && normalizeString(document.fileName) ? { fileName: normalizeString(document.fileName) } : {}),
      ...(hasAttachment && normalizeString(document.mimeType) ? { mimeType: normalizeString(document.mimeType) } : {}),
      ...(hasAttachment ? { hasAttachment } : {}),
      ...(includeAttachmentData && normalizeString(document.attachmentData)
        ? { attachmentData: normalizeString(document.attachmentData) }
        : {}),
      ...(includeAttachmentData && normalizeString(document.attachmentPath)
        ? { attachmentPath: normalizeString(document.attachmentPath) }
        : {}),
    };
  });
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

async function ensureTableColumn(tableName, columnName, columnDefinition) {
  if (!/^[A-Za-z0-9_]+$/.test(tableName) || !/^[A-Za-z0-9_]+$/.test(columnName)) {
    throw new Error('Table and column names may only contain letters, numbers, and underscores');
  }

  const [columns] = await pool.execute(
    `
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `,
    [dbConfig.database, tableName, columnName],
  );

  if (Number(columns[0].count) === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${columnDefinition}`);
  }
}

async function ensureTableIndex(tableName, indexName, indexDefinition) {
  if (!/^[A-Za-z0-9_]+$/.test(tableName) || !/^[A-Za-z0-9_]+$/.test(indexName)) {
    throw new Error('Table and index names may only contain letters, numbers, and underscores');
  }

  const [indexes] = await pool.execute(
    `
    SELECT COUNT(*) AS count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
  `,
    [dbConfig.database, tableName, indexName],
  );

  if (Number(indexes[0].count) === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD ${indexDefinition}`);
  }
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
      account_status VARCHAR(40) NOT NULL DEFAULT 'active',
      activation_token VARCHAR(128) UNIQUE,
      activation_expires_at VARCHAR(40),
      activated_at VARCHAR(40),
      profile_picture_path VARCHAR(255),
      address_line1 VARCHAR(255),
      address_line2 VARCHAR(255),
      city VARCHAR(120),
      state_region VARCHAR(120),
      postal_code VARCHAR(40),
      country VARCHAR(120),
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX idx_users_token (token),
      INDEX idx_users_email (email),
      INDEX idx_users_activation_token (activation_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureTableColumn('users', 'account_status', "account_status VARCHAR(40) NOT NULL DEFAULT 'active' AFTER token");
  await ensureTableColumn('users', 'activation_token', 'activation_token VARCHAR(128) NULL AFTER account_status');
  await ensureTableColumn('users', 'activation_expires_at', 'activation_expires_at VARCHAR(40) NULL AFTER activation_token');
  await ensureTableColumn('users', 'activated_at', 'activated_at VARCHAR(40) NULL AFTER activation_expires_at');
  await ensureTableIndex(
    'users',
    'idx_users_activation_token',
    'INDEX idx_users_activation_token (activation_token)',
  );
  await ensureTableColumn('users', 'profile_picture_path', 'profile_picture_path VARCHAR(255) NULL AFTER token');
  await ensureTableColumn('users', 'address_line1', 'address_line1 VARCHAR(255) NULL AFTER profile_picture_path');
  await ensureTableColumn('users', 'address_line2', 'address_line2 VARCHAR(255) NULL AFTER address_line1');
  await ensureTableColumn('users', 'city', 'city VARCHAR(120) NULL AFTER address_line2');
  await ensureTableColumn('users', 'state_region', 'state_region VARCHAR(120) NULL AFTER city');
  await ensureTableColumn('users', 'postal_code', 'postal_code VARCHAR(40) NULL AFTER state_region');
  await ensureTableColumn('users', 'country', 'country VARCHAR(120) NULL AFTER postal_code');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permits (
      id CHAR(36) PRIMARY KEY,
      requested_by_id CHAR(36) NOT NULL,
      requested_by VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      work_type VARCHAR(100),
      location VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      start_date_time VARCHAR(40) NOT NULL,
      end_date_time VARCHAR(40) NOT NULL,
      hazards LONGTEXT NOT NULL,
      controls LONGTEXT NOT NULL,
      ppe LONGTEXT NOT NULL,
      approvers LONGTEXT NOT NULL,
      is_emergency TINYINT(1) NOT NULL DEFAULT 0,
      documents LONGTEXT NOT NULL,
      assigned_workers LONGTEXT NOT NULL,
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

  const [permitColumns] = await pool.execute(
    `
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'permits'
      AND COLUMN_NAME = 'is_emergency'
  `,
    [dbConfig.database],
  );

  if (Number(permitColumns[0].count) === 0) {
    await pool.query(`
      ALTER TABLE permits
      ADD COLUMN is_emergency TINYINT(1) NOT NULL DEFAULT 0 AFTER approvers
    `);
  }

  await ensureTableColumn('permits', 'work_type', 'work_type VARCHAR(100) NULL AFTER title');
  await ensureTableColumn('permits', 'documents', 'documents LONGTEXT NULL AFTER is_emergency');
  await ensureTableColumn(
    'permits',
    'assigned_workers',
    'assigned_workers LONGTEXT NULL AFTER documents',
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workers (
      id CHAR(36) PRIMARY KEY,
      ic_passport VARCHAR(80),
      employee_id VARCHAR(32) UNIQUE,
      name VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(120) NOT NULL,
      permits LONGTEXT,
      expiry VARCHAR(40),
      certifications LONGTEXT,
      phone VARCHAR(50),
      email VARCHAR(255),
      company VARCHAR(255),
      trade VARCHAR(120),
      organization VARCHAR(255),
      permit_types LONGTEXT NOT NULL,
      competencies LONGTEXT NOT NULL,
      license_expiry VARCHAR(40),
      status VARCHAR(40) DEFAULT 'valid',
      created_by CHAR(36),
      review_comment TEXT,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE INDEX idx_workers_ic_passport (ic_passport),
      INDEX idx_workers_created_by (created_by),
      INDEX idx_workers_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureTableColumn('workers', 'ic_passport', 'ic_passport VARCHAR(80) NULL AFTER id');
  await ensureTableColumn('workers', 'employee_id', 'employee_id VARCHAR(32) UNIQUE AFTER id');
  await ensureTableColumn('workers', 'name', 'name VARCHAR(255) NULL AFTER employee_id');
  await ensureTableColumn('workers', 'role', 'role VARCHAR(100) AFTER name');
  await ensureTableColumn('workers', 'phone', 'phone VARCHAR(50) NULL AFTER role');
  await ensureTableColumn('workers', 'email', 'email VARCHAR(255) NULL AFTER phone');
  await ensureTableColumn('workers', 'company', 'company VARCHAR(255) NULL AFTER email');
  await ensureTableColumn('workers', 'permits', 'permits LONGTEXT AFTER role');
  await ensureTableColumn('workers', 'certifications', 'certifications LONGTEXT NULL AFTER permits');
  await ensureTableColumn('workers', 'expiry', 'expiry VARCHAR(40) AFTER permits');
  await ensureTableColumn('workers', 'status', "status VARCHAR(40) DEFAULT 'valid' AFTER expiry");
  await ensureTableColumn('workers', 'review_comment', 'review_comment TEXT NULL AFTER status');
  await ensureTableColumn('workers', 'created_by', 'created_by CHAR(36) AFTER status');
  await ensureTableColumn('workers', 'created_at', 'created_at VARCHAR(40) NULL AFTER created_by');
  await ensureTableColumn('workers', 'updated_at', 'updated_at VARCHAR(40) NULL AFTER created_at');
  await ensureTableIndex(
    'workers',
    'idx_workers_ic_passport',
    'UNIQUE INDEX idx_workers_ic_passport (ic_passport)',
  );

  const migrationTimestamp = nowIso();
  await pool.execute(
    `
    UPDATE workers
    SET
      status = COALESCE(NULLIF(status, ''), 'valid'),
      created_at = COALESCE(created_at, ?),
      updated_at = COALESCE(updated_at, ?)
  `,
    [migrationTimestamp, migrationTimestamp],
  );

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS extension_requests (
      id CHAR(36) PRIMARY KEY,
      permit_id CHAR(36) NOT NULL,
      requester_user_id CHAR(36),
      worker_name VARCHAR(255),
      worker_email VARCHAR(255),
      worker_employee_id VARCHAR(80),
      requested_minutes INT NOT NULL,
      reason TEXT,
      status VARCHAR(40) NOT NULL DEFAULT 'waiting',
      notes TEXT,
      decided_by CHAR(36),
      decided_at VARCHAR(40),
      requested_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX idx_extension_requests_permit_id (permit_id),
      INDEX idx_extension_requests_status (status),
      INDEX idx_extension_requests_requested_at (requested_at),
      CONSTRAINT fk_extension_requests_permit
        FOREIGN KEY (permit_id) REFERENCES permits(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_extension_requests_requester
        FOREIGN KEY (requester_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_extension_requests_decider
        FOREIGN KEY (decided_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      entity_type VARCHAR(80),
      entity_id CHAR(36),
      read_at VARCHAR(40),
      created_at VARCHAR(40) NOT NULL,
      INDEX idx_notifications_user_created (user_id, created_at),
      INDEX idx_notifications_user_read (user_id, read_at),
      INDEX idx_notifications_entity (entity_type, entity_id),
      CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedDemoUsers();
  await seedDemoWorkers();
  await syncWorkerUsersFromProfiles();
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
    accountStatus: row.account_status || 'active',
    activationToken: row.activation_token || '',
    activationExpiresAt: row.activation_expires_at || '',
    activatedAt: row.activated_at || '',
    profilePicturePath: row.profile_picture_path || '',
    profilePictureUrl: buildProfilePictureUrl(row.profile_picture_path),
    address: {
      line1: row.address_line1 || '',
      line2: row.address_line2 || '',
      city: row.city || '',
      stateRegion: row.state_region || '',
      postalCode: row.postal_code || '',
      country: row.country || '',
    },
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
    workType: row.work_type || extractPermitType(row),
    location: row.location,
    description: row.description,
    startDateTime: row.start_date_time,
    endDateTime: row.end_date_time,
    hazards: decodeJson(row.hazards),
    controls: decodeJson(row.controls),
    ppe: decodeJson(row.ppe),
    approvers: decodeJson(row.approvers),
    isEmergency: Boolean(row.is_emergency),
    documents: serializePermitDocuments(normalizePermitDocuments(decodeJson(row.documents), row.description)),
    assignedWorkers: normalizeAssignedWorkers(decodeJson(row.assigned_workers)),
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

function rowToNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message || '',
    link: row.link || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    readAt: row.read_at || '',
    unread: !row.read_at,
    createdAt: row.created_at,
  };
}

function rowToExtensionRequest(row, permit = null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    requestId: row.id,
    permitId: row.permit_id,
    permit,
    workerName: row.worker_name || '',
    workerEmail: row.worker_email || '',
    workerEmployeeId: row.worker_employee_id || '',
    requestedMinutes: Number(row.requested_minutes) || 0,
    reason: row.reason || '',
    status: row.status || 'waiting',
    notes: row.notes || '',
    decidedBy: row.decided_by,
    decidedAt: row.decided_at || '',
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
  };
}

function rowToWorker(row, options = {}) {
  if (!row) return null;
  return {
    id: row.id,
    icPassport: row.ic_passport,
    employeeId: row.employee_id,
    name: row.name,
    role: row.role,
    position: row.role,
    phone: row.phone,
    email: row.email,
    company: row.company,
    permits: decodeJson(row.permits),
    certifications: serializeWorkerCertifications(decodeJson(row.certifications), options),
    expiry: row.expiry,
    status: row.status,
    reviewComment: row.review_comment || '',
    createdBy: row.created_by,
    createdByName: row.created_by_name || '',
    createdByEmail: row.created_by_email || '',
    createdByEmployeeId: row.created_by_employee_id || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllWorkers(connection = pool, options = {}) {
  const [rows] = await connection.execute(`
    SELECT
      workers.*,
      users.full_name AS created_by_name,
      users.email AS created_by_email,
      users.employee_id AS created_by_employee_id
    FROM workers
    LEFT JOIN users ON users.id = workers.created_by
    ORDER BY workers.created_at DESC
  `);
  return rows.map((row) => rowToWorker(row, options));
}

async function insertWorker(payload, user, connection = pool) {
  const id = createId();
  const timestamp = nowIso();
  await connection.execute(
    `
    INSERT INTO workers (
      id, ic_passport, employee_id, name, role, phone, email, company, permits, certifications, expiry, status, review_comment, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      normalizeString(payload.icPassport) || null,
      payload.employeeId || null,
      normalizeString(payload.name),
      normalizeString(payload.role || payload.position),
      normalizeString(payload.phone),
      normalizeEmail(payload.email) || null,
      normalizeString(payload.company),
      encodeJson(normalizeWorkerPermitList(payload.permits).permits),
      encodeJson(normalizeWorkerCertifications(payload.certifications, [], { persistAttachments: true })),
      normalizeString(payload.expiry),
      normalizeString(payload.status) || 'valid',
      normalizeString(payload.reviewComment),
      user?.id || null,
      timestamp,
      timestamp,
    ],
  );

  const [rows] = await pool.execute(
    `
    SELECT
      workers.*,
      users.full_name AS created_by_name,
      users.email AS created_by_email,
      users.employee_id AS created_by_employee_id
    FROM workers
    LEFT JOIN users ON users.id = workers.created_by
    WHERE workers.id = ?
    LIMIT 1
  `,
    [id],
  );
  const worker = rowToWorker(rows[0]);
  await syncWorkerUserFromProfile(worker);
  return worker;
}

async function getWorkerById(id, connection = pool, options = {}) {
  const [rows] = await connection.execute(
    `
    SELECT
      workers.*,
      users.full_name AS created_by_name,
      users.email AS created_by_email,
      users.employee_id AS created_by_employee_id
    FROM workers
    LEFT JOIN users ON users.id = workers.created_by
    WHERE workers.id = ?
    LIMIT 1
  `,
    [id],
  );
  return rowToWorker(rows[0], options);
}

async function updateWorker(id, payload, user, connection = pool) {
  const timestamp = nowIso();

  await connection.execute(
    `
    UPDATE workers
    SET ic_passport = ?, employee_id = ?, name = ?, role = ?, phone = ?, email = ?, company = ?, permits = ?, certifications = ?, expiry = ?, status = ?, review_comment = ?, updated_at = ?
    WHERE id = ?
  `,
    [
      normalizeString(payload.icPassport) || null,
      payload.employeeId || null,
      normalizeString(payload.name),
      normalizeString(payload.role || payload.position),
      normalizeString(payload.phone),
      normalizeEmail(payload.email) || null,
      normalizeString(payload.company),
      encodeJson(normalizeWorkerPermitList(payload.permits).permits),
      encodeJson(normalizeWorkerCertifications(payload.certifications, payload.existingCertifications, { persistAttachments: true })),
      normalizeString(payload.expiry),
      normalizeString(payload.status) || 'valid',
      normalizeString(payload.reviewComment),
      timestamp,
      id,
    ],
  );

  const worker = await getWorkerById(id);
  await syncWorkerUserFromProfile(worker);
  return worker;
}

async function deleteWorker(id, connection = pool) {
  await connection.execute('DELETE FROM workers WHERE id = ?', [id]);
}

async function updateWorkerStatus(id, status, reviewComment = '') {
  const timestamp = nowIso();
  await pool.execute(
    `
    UPDATE workers
    SET status = ?, review_comment = ?, updated_at = ?
    WHERE id = ?
  `,
    [normalizeString(status), normalizeString(reviewComment), timestamp, id],
  );

  return await getWorkerById(id);
}

async function ensureApprovedWorkerAccount(worker) {
  const email = normalizeEmail(worker?.email);
  const employeeId = normalizeString(worker?.employeeId);
  const fullName = normalizeString(worker?.name);

  if (!email || !employeeId || !fullName) {
    return {
      created: false,
      skipped: true,
      reason: 'Worker email, employee ID, and name are required before an account can be validated',
    };
  }

  const existing = await getUserByEmail(email);
  if (!existing) {
    return {
      created: false,
      skipped: true,
      reason: 'Worker account must be registered before approval',
    };
  }

  if (existing.role !== 'worker') {
    return {
      created: false,
      skipped: true,
      reason: `Email already belongs to a ${existing.role} account`,
    };
  }

  if (normalizeIdentityName(existing.fullName) !== normalizeIdentityName(fullName)) {
    return {
      created: false,
      skipped: true,
      reason: 'Worker profile name does not match the registered worker account',
    };
  }

  if (existing.accountStatus === 'pending_activation') {
    const activation = await setUserActivationPending(existing.id);
    const user = await getUserByEmail(email);
    return {
      created: false,
      activationToken: activation.activationToken,
      activationExpiresAt: activation.activationExpiresAt,
      user: sanitizeUser(user),
    };
  }

  return {
    created: false,
    activationRequired: false,
    user: sanitizeUser(existing),
  };
}

function sanitizeUser(user) {
  const { passwordHash, token, activationToken, ...safeUser } = user;
  return safeUser;
}

function canViewWorker(user, worker) {
  if (!user || !worker) return false;
  return isAdmin(user) || worker.status === 'valid' || worker.createdBy === user.id;
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

async function getUserById(id, connection = pool) {
  const [rows] = await connection.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rowToUser(rows[0]);
}

async function getUsersByRoles(roles, connection = pool) {
  const roleList = Array.isArray(roles) ? roles.map(normalizeString).filter(Boolean) : [];
  if (!roleList.length) return [];

  const placeholders = roleList.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT * FROM users WHERE role IN (${placeholders}) AND account_status = 'active' ORDER BY full_name`,
    roleList,
  );
  return rows.map(rowToUser);
}

async function getUsersByEmployeeIds(employeeIds, connection = pool) {
  const ids = normalizeAssignedWorkers(employeeIds);
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT * FROM users WHERE employee_id IN (${placeholders}) AND account_status = 'active' ORDER BY full_name`,
    ids,
  );
  return rows.map(rowToUser);
}

function uniqueUsers(users = []) {
  const seen = new Set();
  return (users || []).filter((user) => {
    if (!user?.id || seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

async function createNotification(payload, connection = pool) {
  const userId = normalizeString(payload?.userId);
  const title = normalizeString(payload?.title).slice(0, 255);

  if (!userId || !title) {
    return null;
  }

  const id = createId();
  const timestamp = nowIso();
  await connection.execute(
    `
    INSERT INTO notifications (
      id, user_id, type, title, message, link, entity_type, entity_id, read_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `,
    [
      id,
      userId,
      normalizeString(payload.type || 'general').slice(0, 80),
      title,
      normalizeString(payload.message).slice(0, 2000),
      normalizeString(payload.link).slice(0, 255),
      normalizeString(payload.entityType).slice(0, 80),
      normalizeString(payload.entityId) || null,
      timestamp,
    ],
  );

  const [rows] = await connection.execute('SELECT * FROM notifications WHERE id = ? LIMIT 1', [id]);
  return rowToNotification(rows[0]);
}

async function createNotificationsForUsers(users, payload, options = {}) {
  const actorUserId = normalizeString(options.actorUserId);
  const recipients = uniqueUsers(users).filter((user) => user.id !== actorUserId);
  const created = [];

  for (const user of recipients) {
    const link =
      typeof payload.linkByRole === 'function'
        ? payload.linkByRole(user.role, user)
        : payload.link;
    const notification = await createNotification({ ...payload, link, userId: user.id });
    if (notification) created.push(notification);
  }

  return created;
}

async function safelyNotify(label, action) {
  try {
    await action();
  } catch (error) {
    console.error(`Notification failure (${label}):`, error);
  }
}

async function getNotificationsForUser(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const unreadOnly = Boolean(options.unreadOnly);
  const [rows] = await pool.execute(
    `
    SELECT *
    FROM notifications
    WHERE user_id = ?
      ${unreadOnly ? 'AND read_at IS NULL' : ''}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `,
    [userId],
  );
  return rows.map(rowToNotification);
}

function normalizeAddressPayload(address) {
  const source = address && typeof address === 'object' ? address : {};
  return {
    line1: normalizeString(source.line1).slice(0, 255),
    line2: normalizeString(source.line2).slice(0, 255),
    city: normalizeString(source.city).slice(0, 120),
    stateRegion: normalizeString(source.stateRegion).slice(0, 120),
    postalCode: normalizeString(source.postalCode).slice(0, 40),
    country: normalizeString(source.country).slice(0, 120),
  };
}

async function updateUserAddress(userId, address) {
  const normalized = normalizeAddressPayload(address);
  const timestamp = nowIso();
  await pool.execute(
    `
    UPDATE users
    SET
      address_line1 = ?,
      address_line2 = ?,
      city = ?,
      state_region = ?,
      postal_code = ?,
      country = ?,
      updated_at = ?
    WHERE id = ?
  `,
    [
      normalized.line1,
      normalized.line2,
      normalized.city,
      normalized.stateRegion,
      normalized.postalCode,
      normalized.country,
      timestamp,
      userId,
    ],
  );
  return getUserById(userId);
}

async function updateUserProfilePicture(userId, profilePicturePath) {
  await pool.execute('UPDATE users SET profile_picture_path = ?, updated_at = ? WHERE id = ?', [
    profilePicturePath,
    nowIso(),
    userId,
  ]);
  return getUserById(userId);
}

async function updateUserPassword(userId, password) {
  await pool.execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    hashPassword(password),
    nowIso(),
    userId,
  ]);
}

async function getUserByActivationToken(token) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE activation_token = ? LIMIT 1', [
    normalizeString(token),
  ]);
  return rowToUser(rows[0]);
}

async function setUserActivationPending(userId, connection = pool) {
  const activationToken = createActivationToken();
  const activationExpiresAt = createActivationExpiry();
  const timestamp = nowIso();

  await connection.execute(
    `
    UPDATE users
    SET
      password_hash = ?,
      token = NULL,
      account_status = 'pending_activation',
      activation_token = ?,
      activation_expires_at = ?,
      activated_at = NULL,
      updated_at = ?
    WHERE id = ?
  `,
    [hashPassword(createRandomToken()), activationToken, activationExpiresAt, timestamp, userId],
  );

  return {
    activationToken,
    activationExpiresAt,
  };
}

async function activateUserAccount(activationToken, password) {
  const user = await getUserByActivationToken(activationToken);
  if (!user) {
    return { error: 'Invalid activation link', status: 404 };
  }

  if (user.accountStatus !== 'pending_activation') {
    return { error: 'Account is already active', status: 409 };
  }

  const expiry = new Date(user.activationExpiresAt);
  if (!user.activationExpiresAt || Number.isNaN(expiry.getTime()) || expiry.getTime() < Date.now()) {
    return { error: 'Activation link has expired. Ask Admin to resend access.', status: 410 };
  }

  const timestamp = nowIso();
  await pool.execute(
    `
    UPDATE users
    SET
      password_hash = ?,
      account_status = 'active',
      activation_token = NULL,
      activation_expires_at = NULL,
      activated_at = ?,
      updated_at = ?
    WHERE id = ?
  `,
    [hashPassword(password), timestamp, timestamp, user.id],
  );

  return {
    user: await getUserById(user.id),
  };
}

async function syncWorkerUserFromProfile(worker, connection = pool) {
  const email = normalizeEmail(worker?.email);
  const employeeId = normalizeString(worker?.employeeId);
  if (!email || !employeeId) return;

  await connection.execute(
    `
    UPDATE users
    SET employee_id = ?, updated_at = ?
    WHERE role = 'worker'
      AND LOWER(email) = LOWER(?)
      AND employee_id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM (
          SELECT id
          FROM users
          WHERE employee_id = ?
            AND LOWER(email) <> LOWER(?)
          LIMIT 1
        ) AS conflicting_user
      )
  `,
    [employeeId, nowIso(), email, employeeId, employeeId, email],
  );
}

async function syncWorkerUsersFromProfiles(connection = pool) {
  const [workers] = await connection.execute(
    `
    SELECT employee_id AS employeeId, email
    FROM workers
    WHERE email IS NOT NULL
      AND email <> ''
      AND employee_id IS NOT NULL
      AND employee_id <> ''
  `,
  );

  for (const worker of workers) {
    await syncWorkerUserFromProfile(worker, connection);
  }
}

async function insertUser({ employeeId, fullName, email, organization, role, password }, connection = pool) {
  const id = createId();
  const timestamp = nowIso();
  let resolvedEmployeeId = employeeId;

  if (!resolvedEmployeeId && role === 'worker') {
    const [matchingWorkers] = await connection.execute(
      `
      SELECT employee_id
      FROM workers
      WHERE LOWER(email) = LOWER(?)
        AND employee_id IS NOT NULL
        AND employee_id <> ''
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [normalizeEmail(email)],
    );
    resolvedEmployeeId = matchingWorkers[0]?.employee_id;
  }

  resolvedEmployeeId = resolvedEmployeeId || (await createEmployeeId(connection));

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
    {
      employeeId: 'W01',
      fullName: 'John Doe',
      email: 'worker@example.com',
      organization: 'Global Engineering',
      role: 'worker',
      password: 'worker12345',
    },
    {
      employeeId: 'THYAA-W01',
      fullName: 'Thyaa Worker',
      email: 'thyaaworker@example.com',
      organization: 'Global Engineering',
      role: 'worker',
      password: 'worker12345',
    },
  ];

  for (const demoUser of demoUsers) {
    const existing = await getUserByEmail(demoUser.email);

    if (!existing) {
      await insertUser(demoUser);
    }
  }
}

async function seedDemoWorkers() {
  const adminUser = await getUserByEmail('admin@example.com');
  const demoWorkers = [
    {
      name: 'Thyaa Worker',
      icPassport: 'THYAA-WORKER-001',
      employeeId: 'THYAA-W01',
      role: 'Hot Work Worker',
      phone: '',
      email: 'thyaaworker@example.com',
      company: 'Global Engineering',
      permits: ['Hot Work', 'General Maintenance', 'Work at Height'],
      certifications: [
        {
          type: 'Safety Induction',
          number: 'SI-THYAA-001',
          issuer: 'PTW Guardian',
          issueDate: '2026-01-01',
          expiryDate: '2027-01-01',
        },
        {
          type: 'Hot Work',
          number: 'HW-THYAA-001',
          issuer: 'PTW Guardian',
          issueDate: '2026-01-01',
          expiryDate: '2027-01-01',
        },
      ],
      expiry: '2027-01-01',
      status: 'valid',
      reviewComment: '',
    },
  ];

  for (const worker of demoWorkers) {
    const [rows] = await pool.execute(
      `
      SELECT id
      FROM workers
      WHERE employee_id = ? OR email = ? OR ic_passport = ?
      LIMIT 1
    `,
      [worker.employeeId, normalizeEmail(worker.email), worker.icPassport],
    );

    if (!rows.length) {
      await insertWorker(worker, adminUser || null);
    }
  }
}

async function getPermitById(id) {
  const [rows] = await pool.execute('SELECT * FROM permits WHERE id = ? LIMIT 1', [id]);
  return rowToPermit(rows[0]);
}

async function getStoredPermitDocuments(id, connection = pool) {
  const [rows] = await connection.execute('SELECT documents, description FROM permits WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return [];
  return normalizePermitDocuments(decodeJson(rows[0].documents), rows[0].description);
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

async function getExtensionRequestById(id) {
  const [rows] = await pool.execute('SELECT * FROM extension_requests WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return null;

  const permit = await getPermitById(rows[0].permit_id);
  return rowToExtensionRequest(rows[0], permit);
}

async function getExtensionRequestsForUser(user) {
  const [rows] = await pool.execute(
    `
    SELECT *
    FROM extension_requests
    ORDER BY requested_at DESC, updated_at DESC
  `,
  );

  const requests = [];
  for (const row of rows) {
    const permit = await getPermitById(row.permit_id);
    if (permit && canViewPermit(user, permit)) {
      requests.push(rowToExtensionRequest(row, permit));
    }
  }

  return requests;
}

function canCreateExtensionRequest(user, permit) {
  return isAssignedWorker(user, permit) || user.role === 'supervisor' || user.role === 'approver' || isAdmin(user);
}

function canDecideExtensionRequest(user) {
  return user.role === 'supervisor' || user.role === 'approver' || isAdmin(user);
}

async function insertExtensionRequest(permit, user, { requestedMinutes, reason }) {
  const connection = await pool.getConnection();
  const id = createId();
  const timestamp = nowIso();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
      INSERT INTO extension_requests (
        id,
        permit_id,
        requester_user_id,
        worker_name,
        worker_email,
        worker_employee_id,
        requested_minutes,
        reason,
        status,
        requested_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)
    `,
      [
        id,
        permit.id,
        user.id,
        user.fullName || '',
        user.email || '',
        user.employeeId || '',
        requestedMinutes,
        normalizeString(reason) || 'Extension requested by worker',
        timestamp,
        timestamp,
      ],
    );

    await insertAuditLog(
      {
        permitId: permit.id,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'extension requested',
        fromStatus: permit.status,
        toStatus: permit.status,
        comment: `Extension requested for ${requestedMinutes} minutes. ${normalizeString(reason)}`.trim(),
      },
      connection,
    );

    await connection.commit();
    return await getExtensionRequestById(id);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Permit insert rollback failed after error:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function decideExtensionRequest(request, user, { status, notes }) {
  const connection = await pool.getConnection();
  const timestamp = nowIso();
  const normalizedNotes = normalizeString(notes);

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
      UPDATE extension_requests
      SET status = ?, notes = ?, decided_by = ?, decided_at = ?, updated_at = ?
      WHERE id = ?
    `,
      [status, normalizedNotes, user.id, timestamp, timestamp, request.id],
    );

    if (status === 'approved') {
      const extendedEndDateTime = addMinutesToIso(request.permit?.endDateTime, request.requestedMinutes);
      if (!extendedEndDateTime) {
        throw new Error('Unable to extend permit because the current end time is invalid');
      }

      await connection.execute(
        `
        UPDATE permits
        SET end_date_time = ?, updated_at = ?
        WHERE id = ?
      `,
        [extendedEndDateTime, timestamp, request.permitId],
      );
    }

    await insertAuditLog(
      {
        permitId: request.permitId,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'extension reviewed',
        fromStatus: request.status,
        toStatus: status,
        comment: `Extension ${status} for ${request.requestedMinutes} minutes. ${normalizedNotes}`.trim(),
      },
      connection,
    );

    await connection.commit();
    return await getExtensionRequestById(request.id);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Permit update rollback failed after error:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
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
        work_type,
        location,
        description,
        start_date_time,
        end_date_time,
        hazards,
        controls,
        ppe,
        approvers,
        is_emergency,
        documents,
        assigned_workers,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `,
      [
        id,
        user.id,
        user.fullName,
        normalizeString(payload.title),
        normalizeString(payload.workType || payload.permitType || extractPermitType(payload)),
        normalizeString(payload.location),
        normalizeString(payload.description),
        normalizeString(payload.startDateTime),
        normalizeString(payload.endDateTime),
        encodeJson(normalizePermitHazards(payload)),
        encodeJson(normalizeArray(payload.controls)),
        encodeJson(normalizeArray(payload.ppe)),
        encodeJson(normalizeArray(payload.approvers)),
        payload.isEmergency ? 1 : 0,
        JSON.stringify(normalizePermitDocumentsForStorage(payload.documents, payload.description)),
        encodeJson(normalizeAssignedWorkers(payload.assignedWorkers)),
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

    const permit = await getPermitById(id);
    await safelyNotify('permit created', () => notifyPermitCreated(permit, user));

    return {
      ...permit,
      auditLogs: [createdLog],
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePermitDetails(permit, payload, user) {
  const connection = await pool.getConnection();
  const timestamp = nowIso();

  try {
    await connection.beginTransaction();
    const existingDocuments = await getStoredPermitDocuments(permit.id, connection);

    await connection.execute(
      `
      UPDATE permits
      SET
        title = ?,
        work_type = ?,
        location = ?,
        description = ?,
        start_date_time = ?,
        end_date_time = ?,
        hazards = ?,
        controls = ?,
        ppe = ?,
        approvers = ?,
        is_emergency = ?,
        documents = ?,
        assigned_workers = ?,
        updated_at = ?
      WHERE id = ?
    `,
      [
        normalizeString(payload.title),
        normalizeString(payload.workType || payload.permitType || extractPermitType(payload)),
        normalizeString(payload.location),
        normalizeString(payload.description),
        normalizeString(payload.startDateTime),
        normalizeString(payload.endDateTime),
        encodeJson(normalizePermitHazards(payload)),
        encodeJson(normalizeArray(payload.controls)),
        encodeJson(normalizeArray(payload.ppe)),
        encodeJson(normalizeArray(payload.approvers)),
        payload.isEmergency ? 1 : 0,
        JSON.stringify(
          normalizePermitDocumentsForStorage(
            payload.documents,
            payload.description,
            existingDocuments,
          ),
        ),
        encodeJson(normalizeAssignedWorkers(payload.assignedWorkers)),
        timestamp,
        permit.id,
      ],
    );

    await insertAuditLog(
      {
        permitId: permit.id,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'details updated',
        fromStatus: permit.status,
        toStatus: permit.status,
        comment:
          permit.status === 'rejected'
            ? 'Rejected permit revised by requester'
            : 'Draft permit details updated by requester',
      },
      connection,
    );

    await connection.commit();

    const updatedPermit = await getPermitById(permit.id);
    await safelyNotify('permit status changed', () =>
      notifyPermitStatusChanged(updatedPermit, permit.status, user),
    );

    return {
      ...updatedPermit,
      auditLogs: await getAuditLogs(permit.id),
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

function canRunHseReview(user) {
  return user.role === 'safety_officer';
}

function normalizeIdentifier(value) {
  return normalizeString(value).toLowerCase();
}

function isAssignedWorker(user, permit) {
  if (user.role !== 'worker') return false;

  const userIdentifiers = new Set(
    [user.employeeId, user.fullName, user.email]
      .map(normalizeIdentifier)
      .filter(Boolean),
  );

  return (permit.assignedWorkers || []).some((workerId) =>
    userIdentifiers.has(normalizeIdentifier(workerId)),
  );
}

function canWorkerAccessPermit(user, permit) {
  return isAssignedWorker(user, permit) && !['draft', 'cancelled'].includes(permit.status);
}

function canViewPermit(user, permit) {
  if (isEmergencyPermit(permit)) {
    return (
      permit.requestedById === user.id ||
      (user.role === 'safety_officer' && permit.status !== 'draft') ||
      canWorkerAccessPermit(user, permit)
    );
  }

  return isAdmin(user) || isReviewer(user) || permit.requestedById === user.id || canWorkerAccessPermit(user, permit);
}

function canCreatePermit(user) {
  return PERMIT_CREATORS.has(user.role);
}

function canUpdatePermitDetails(user, permit) {
  return (
    isAdmin(user) ||
    (user.role === 'requester' &&
      permit.requestedById === user.id &&
      ['draft', 'rejected'].includes(permit.status))
  );
}

function isEmergencyPermit(permit) {
  return Boolean(permit.isEmergency);
}

function permitDisplayTitle(permit) {
  return normalizeString(permit?.title || permit?.workType || permit?.id || 'Permit');
}

function permitLinkForRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'safety_officer') return '/safety';
  if (role === 'supervisor' || role === 'approver') return '/review';
  if (role === 'worker') return '/worker';
  return '/dashboard';
}

function workerProfileLinkForRole(role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

async function notifyPermitCreated(permit, actorUser) {
  const title = permitDisplayTitle(permit);
  const recipients = isEmergencyPermit(permit)
    ? await getUsersByRoles(['safety_officer'])
    : await getUsersByRoles(['admin']);

  await createNotificationsForUsers(
    recipients,
    {
      type: isEmergencyPermit(permit) ? 'emergency_permit_created' : 'permit_draft_created',
      title: isEmergencyPermit(permit) ? 'Emergency permit draft created' : 'Permit draft ready for Admin review',
      message: `${title} was created by ${actorUser.fullName}.`,
      link: isEmergencyPermit(permit) ? '/safety' : '/admin',
      entityType: 'permit',
      entityId: permit.id,
    },
    { actorUserId: actorUser.id },
  );
}

async function notifyPermitStatusChanged(permit, previousStatus, actorUser) {
  const title = permitDisplayTitle(permit);
  const requester = permit.requestedById ? await getUserById(permit.requestedById) : null;
  const assignedWorkers = await getUsersByEmployeeIds(permit.assignedWorkers || []);
  let recipients = [];
  let notificationTitle = 'Permit status updated';
  let message = `${title} changed from ${previousStatus} to ${permit.status}.`;

  if (permit.status === 'submitted') {
    recipients = isEmergencyPermit(permit)
      ? await getUsersByRoles(['safety_officer'])
      : await getUsersByRoles(['supervisor', 'safety_officer']);
    notificationTitle = isEmergencyPermit(permit)
      ? 'Emergency permit needs Safety review'
      : 'Permit submitted for review';
    message = `${title} is waiting for ${isEmergencyPermit(permit) ? 'Safety Officer' : 'Supervisor/Safety'} review.`;
  } else if (permit.status === 'stage1_complete') {
    recipients = await getUsersByRoles(['safety_officer']);
    notificationTitle = 'Permit ready for Safety Stage 2';
    message = `${title} completed Stage 1 and needs Safety Officer review.`;
  } else if (permit.status === 'approved') {
    recipients = uniqueUsers([requester, ...assignedWorkers, ...(await getUsersByRoles(['supervisor']))]);
    notificationTitle = 'Permit approved';
    message = `${title} has been approved and is ready for activation/monitoring.`;
  } else if (permit.status === 'active') {
    recipients = uniqueUsers([requester, ...assignedWorkers]);
    notificationTitle = 'Permit is active';
    message = `${title} is active. Monitor controls and close it when work is complete.`;
  } else if (permit.status === 'rejected') {
    recipients = requester ? [requester] : [];
    notificationTitle = 'Permit needs revision';
    message = `${title} was returned for revision.`;
  } else if (permit.status === 'closed') {
    recipients = uniqueUsers([requester, ...assignedWorkers]);
    notificationTitle = 'Permit closed';
    message = `${title} has been closed.`;
  } else if (permit.status === 'cancelled') {
    recipients = uniqueUsers([requester, ...assignedWorkers]);
    notificationTitle = 'Permit cancelled';
    message = `${title} has been cancelled.`;
  } else {
    recipients = requester ? [requester] : [];
  }

  await createNotificationsForUsers(
    recipients,
    {
      type: `permit_${permit.status}`,
      title: notificationTitle,
      message,
      linkByRole: (role) => permitLinkForRole(role),
      entityType: 'permit',
      entityId: permit.id,
    },
    { actorUserId: actorUser.id },
  );
}

async function notifyWorkerSubmitted(worker, actorUser) {
  const recipients = await getUsersByRoles(['admin']);
  await createNotificationsForUsers(
    recipients,
    {
      type: 'worker_submitted',
      title: 'Worker profile needs review',
      message: `${worker.name} was submitted by ${actorUser.fullName}.`,
      link: '/admin',
      entityType: 'worker',
      entityId: worker.id,
    },
    { actorUserId: actorUser.id },
  );
}

async function notifyWorkerReviewed(worker, actorUser) {
  const recipients = uniqueUsers([
    worker.createdBy ? await getUserById(worker.createdBy) : null,
    worker.email ? await getUserByEmail(worker.email) : null,
  ]);
  const isValid = String(worker.status || '').toLowerCase() === 'valid';

  await createNotificationsForUsers(
    recipients,
    {
      type: isValid ? 'worker_valid' : 'worker_rejected',
      title: isValid ? 'Worker profile approved' : 'Worker profile returned',
      message: isValid
        ? `${worker.name} is approved for PTW assignment.`
        : `${worker.name} needs worker profile revision.`,
      linkByRole: (role) => workerProfileLinkForRole(role),
      entityType: 'worker',
      entityId: worker.id,
    },
    { actorUserId: actorUser.id },
  );
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

function requireApprover(req, res, next) {
  if (req.user.role !== 'approver') {
    return res.status(403).json({
      error: 'Supervisor command center is available to supervisor users only',
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
    .filter((permit) => ['active', 'approved', 'stage1_complete', 'submitted'].includes(permit.status))
    .slice(0, 5);

  return {
    user: sanitizeUser(user),
    site: 'Main Plant Alpha (Sector 4)',
    stats: {
      draftPermits: counts.draft || 0,
      pendingApproval: (counts.submitted || 0) + (counts.stage1_complete || 0),
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

function isPermitDueWithin(permit, hours) {
  const end = new Date(permit.endDateTime);
  if (Number.isNaN(end.getTime())) return false;

  const diff = end.getTime() - Date.now();
  return diff > 0 && diff <= hours * 60 * 60 * 1000;
}

function classifyApproverPermit(permit) {
  if (permit.status === 'approved') {
    return {
      label: 'Safety Verified',
      tone: 'verified',
      action: 'Release Work',
    };
  }

  if (permit.status === 'active') {
    return {
      label: 'Active Work',
      tone: 'active',
      action: 'Monitor',
    };
  }

  if (permit.status === 'rejected') {
    return {
      label: 'Risk Flagged',
      tone: 'flagged',
      action: 'Review',
    };
  }

  return {
    label: 'Pending Review',
    tone: 'pending',
    action: 'Review',
  };
}

function buildApproverDashboard(user, permits) {
  const commandStatuses = new Set(['submitted', 'approved', 'active', 'rejected']);
  const commandPermits = permits.filter(
    (permit) => !permit.isEmergency && commandStatuses.has(permit.status),
  );
  const activePermits = permits.filter((permit) => permit.status === 'active');
  const approvedCycle = permits.filter((permit) => ['approved', 'active'].includes(permit.status));
  const expiringPermits = approvedCycle.filter((permit) => isPermitDueWithin(permit, 2));

  const queue = commandPermits
    .map((permit) => {
      const stage = classifyApproverPermit(permit);
      return {
        ...permit,
        workflowStage: stage.label,
        stageTone: stage.tone,
        primaryAction: stage.action,
      };
    })
    .sort((a, b) => {
      const priority = { approved: 0, submitted: 1, rejected: 2, active: 3 };
      const statusDelta = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
      if (statusDelta) return statusDelta;
      return new Date(a.startDateTime) - new Date(b.startDateTime);
    });

  return {
    user: sanitizeUser(user),
    stats: {
      pendingApprovals: commandPermits.filter((permit) =>
        ['submitted', 'approved', 'rejected'].includes(permit.status),
      ).length,
      approvedPermits: approvedCycle.length,
      activeWork: activePermits.length,
      liveTeams: activePermits.reduce(
        (total, permit) => total + Math.max(1, (permit.assignedWorkers || []).length),
        0,
      ),
      expiringPermits: expiringPermits.length,
    },
    queue,
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
    if (nextStatus === 'submitted') {
      if (isEmergencyPermit(permit)) {
        return isOwnerRequester
          ? { allowed: true }
          : {
              allowed: false,
              httpStatus: 403,
              error: 'Only the requester who created this emergency draft can submit it to Safety Officer review',
            };
      }

      return {
        allowed: false,
        httpStatus: 403,
        error: 'Normal permit drafts must be submitted by Admin Lane 2 after draft review',
      };
    }

    return isOwnerRequester
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester who created this draft can cancel it',
        };
  }

  if (permit.status === 'submitted' && nextStatus === 'stage1_complete') {
    if (isEmergencyPermit(permit)) {
      return {
        allowed: false,
        httpStatus: 409,
        error: 'Emergency permits do not use the normal Stage 1 completion lane',
      };
    }

    return user.role === 'safety_officer'
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the safety officer can complete Stage 1 review',
        };
  }

  if (permit.status === 'submitted' && ['approved', 'rejected'].includes(nextStatus)) {
    if (isEmergencyPermit(permit)) {
      return user.role === 'safety_officer'
        ? { allowed: true }
        : {
            allowed: false,
            httpStatus: 403,
            error: 'Only the safety officer can approve or reject emergency permits',
          };
    }

    return user.role === 'supervisor' || user.role === 'safety_officer'
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the supervisor or safety officer can approve or reject normal permits',
        };
  }

  if (permit.status === 'stage1_complete' && ['approved', 'rejected', 'cancelled'].includes(nextStatus)) {
    return user.role === 'safety_officer' || isAdmin(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the safety officer can complete Stage 2 or return this permit',
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

  if (permit.status === 'rejected' && ['submitted', 'cancelled'].includes(nextStatus)) {
    if (nextStatus === 'submitted') {
      if (isEmergencyPermit(permit)) {
        return isOwnerRequester
          ? { allowed: true }
          : {
              allowed: false,
              httpStatus: 403,
              error: 'Only the requester who created this emergency permit can re-submit it to Safety Officer review',
            };
      }

      return {
        allowed: false,
        httpStatus: 403,
        error: 'Returned or rejected permits must be re-submitted by Admin Lane 2 after requester correction',
      };
    }

    return isOwnerRequester
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester who created this rejected permit can cancel it',
        };
  }

  if (permit.status === 'approved' && ['active', 'rejected', 'cancelled'].includes(nextStatus)) {
    if (isEmergencyPermit(permit)) {
      return user.role === 'safety_officer'
        ? { allowed: true }
        : {
            allowed: false,
            httpStatus: 403,
            error: 'Only the safety officer can activate or cancel approved emergency permits',
          };
    }

    if (nextStatus === 'active') {
      return user.role === 'supervisor'
        ? { allowed: true }
        : {
            allowed: false,
            httpStatus: 403,
            error: 'Only the supervisor can activate approved permits',
          };
    }

    return isReviewer(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only supervisor, safety officer, approver, or admin can release, return, or cancel approved permits',
        };
  }

  if (permit.status === 'active' && nextStatus === 'closed') {
    return isOwnerRequester || isReviewer(user) || isAdmin(user) || isAssignedWorker(user, permit)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only the requester, assigned worker, supervisor, safety officer, approver, or admin can close active permits',
        };
  }

  if (permit.status === 'active' && ['rejected', 'cancelled'].includes(nextStatus)) {
    return isReviewer(user) || isAdmin(user)
      ? { allowed: true }
      : {
          allowed: false,
          httpStatus: 403,
          error: 'Only supervisor, safety officer, approver, or admin can return or cancel active permits',
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
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM extension_requests');
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM permits');
  await pool.query('DELETE FROM workers');
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

app.get('/supervisor.css', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'supervisor.css'));
});

app.get('/supervisor.js', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'supervisor.js'));
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

app.get(['/activate', '/activate.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'activate.html'));
});

app.get('/dashboard', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'dashboard.html'));
});

app.get(['/account', '/account.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'account.html'));
});

app.get(['/support', '/support.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'support.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'admin.html'));
});

app.get(['/safety', '/safety.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'safety.html'));
});

app.get(['/approver', '/approver.html'], (req, res) => {
  res.redirect(302, '/supervisor');
});

app.get(['/review', '/review.html', '/supervisor', '/supervisor.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'supervisor.html'));
});

app.get(['/worker', '/worker.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'worker.html'));
});

app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: false,
}));

app.get('/admin.css', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'admin.css'));
});

app.get('/admin.js', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'admin.js'));
});

app.get('/safety.css', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'safety.css'));
});

app.get('/safety.js', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'safety.js'));
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

  if (user?.accountStatus === 'pending_activation') {
    return res.status(403).json({
      error: 'Account pending activation. Open the activation link from Admin to set your password.',
      activationRequired: true,
    });
  }

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

app.post('/api/auth/activate', async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Activation token and password are required' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const activation = await activateUserAccount(token, String(password));
  if (activation.error) {
    return res.status(activation.status).json({ error: activation.error });
  }

  const authToken = createRandomToken();
  await updateUserToken(activation.user.id, authToken);
  const user = await getUserById(activation.user.id);

  res.json({
    user: sanitizeUser({ ...user, token: authToken }),
    token: authToken,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/notifications', authenticate, async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const unreadOnly = ['1', 'true', 'yes'].includes(String(req.query.unreadOnly || '').toLowerCase());
  const notifications = await getNotificationsForUser(req.user.id, { limit, unreadOnly });
  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [req.user.id],
  );

  res.json({
    count: notifications.length,
    unreadCount: Number(countRows[0].count) || 0,
    notifications,
    data: notifications,
  });
});

app.patch('/api/notifications/read-all', authenticate, async (req, res) => {
  const timestamp = nowIso();
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
    [timestamp, req.user.id],
  );

  res.json({ status: 'ok', updated: result.affectedRows || 0 });
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  const timestamp = nowIso();
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?',
    [timestamp, req.params.id, req.user.id],
  );

  if (!result.affectedRows) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ? AND user_id = ? LIMIT 1', [
    req.params.id,
    req.user.id,
  ]);
  res.json(rowToNotification(rows[0]));
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  await updateUserToken(req.user.id, null);
  res.json({ status: 'ok' });
});

app.patch('/api/account', authenticate, async (req, res) => {
  const user = await updateUserAddress(req.user.id, req.body?.address);
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/account/profile-picture', authenticate, async (req, res) => {
  const { fileName, mimeType, attachmentData } = req.body || {};
  const normalizedMimeType = normalizeString(mimeType).toLowerCase();
  const normalizedAttachmentData = normalizeBase64Upload(attachmentData);

  if (!fileName || !normalizedAttachmentData) {
    return res.status(400).json({ error: 'Profile picture file is required' });
  }

  if (!PROFILE_PICTURE_MIME_TYPES.has(normalizedMimeType)) {
    return res.status(400).json({
      error: 'Profile picture must be a JPG, PNG, or WebP image',
      allowedTypes: Array.from(PROFILE_PICTURE_MIME_TYPES),
    });
  }

  if (decodeBase64Size(normalizedAttachmentData) > MAX_PROFILE_PICTURE_BYTES) {
    return res.status(413).json({ error: 'Profile picture must be 10 MB or smaller' });
  }

  const profilePicturePath = storeProfilePicture(
    req.user.id,
    fileName,
    normalizedMimeType,
    normalizedAttachmentData,
  );
  const user = await updateUserProfilePicture(req.user.id, profilePicturePath);
  res.json({ user: sanitizeUser(user) });
});

app.patch('/api/account/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  await updateUserPassword(req.user.id, String(newPassword));
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

app.get('/api/approver/dashboard', authenticate, requireApprover, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM permits ORDER BY created_at DESC');
  const permits = rows.map(rowToPermit).filter((permit) => canViewPermit(req.user, permit));

  res.json(buildApproverDashboard(req.user, permits));
});

app.get('/api/workers', authenticate, async (req, res) => {
  const allWorkers = await getAllWorkers();
  const workers = allWorkers.filter((worker) => canViewWorker(req.user, worker));
  res.json({ count: workers.length, workers, data: workers });
});

app.post('/api/workers', authenticate, async (req, res) => {
  if (!isAdmin(req.user) && req.user.role !== 'requester') {
    return res.status(403).json({ error: 'Only requester or admin may submit worker profiles' });
  }

  const {
    name,
    icPassport,
    employeeId,
    role,
    position,
    phone,
    email,
    company,
    permits,
    certifications,
    expiry,
    status,
  } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!normalizeString(icPassport)) {
    return res.status(400).json({ error: 'IC/Passport number is required' });
  }

  const workerAccount = await validateWorkerAccountReference({ name, email });
  if (workerAccount.error) {
    return res.status(workerAccount.status).json({ error: workerAccount.error });
  }

  const workerPermits = normalizeWorkerPermitList(permits);
  if (workerPermits.invalidPermits.length) {
    return res.status(400).json({
      error: `Unsupported permit type(s): ${workerPermits.invalidPermits.join(', ')}`,
      allowedPermitTypes: WORKER_PERMIT_TYPES,
    });
  }

  try {
    const requestedStatus = normalizeString(status);
    const initialStatus = isAdmin(req.user)
      ? requestedStatus || 'valid'
      : 'submitted';
    const worker = await insertWorker(
      {
        name,
        icPassport,
        employeeId: workerAccount.account.employeeId,
        role: role || position,
        phone,
        email: workerAccount.account.email,
        company: company || workerAccount.account.organization,
        permits: workerPermits.permits,
        certifications,
        expiry,
        status: initialStatus,
        reviewComment: '',
      },
      req.user,
    );
    if (String(worker.status || '').toLowerCase() === 'submitted') {
      await safelyNotify('worker submitted', () => notifyWorkerSubmitted(worker, req.user));
    }
    return res.status(201).json(worker);
  } catch (e) {
    if (e instanceof Error && /Certification file/i.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Worker ID or IC/Passport already exists' });
    }
    throw e;
  }
});

app.patch('/api/workers/:id', authenticate, async (req, res) => {
  const noworker = await getWorkerById(req.params.id, pool, { includeAttachmentData: true });
  if (!noworker) return res.status(404).json({ error: 'Worker not found' });
  const isOwnerRequester = req.user.role === 'requester' && noworker.createdBy === req.user.id;
  if (!isAdmin(req.user) && !isOwnerRequester) {
    return res.status(403).json({ error: 'Only the requester owner or admin may update this worker profile' });
  }
  if (isOwnerRequester && noworker.status === 'valid') {
    return res.status(403).json({ error: 'Approved worker profiles must be changed through Admin review' });
  }
  const nextIcPassport = Object.prototype.hasOwnProperty.call(req.body || {}, 'icPassport')
    ? req.body.icPassport
    : noworker.icPassport;
  const nextName = Object.prototype.hasOwnProperty.call(req.body || {}, 'name')
    ? req.body.name
    : noworker.name;
  const nextEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email')
    ? req.body.email
    : noworker.email;
  if (!normalizeString(nextIcPassport)) {
    return res.status(400).json({ error: 'IC/Passport number is required' });
  }

  const workerAccount = await validateWorkerAccountReference({ name: nextName, email: nextEmail });
  if (workerAccount.error) {
    return res.status(workerAccount.status).json({ error: workerAccount.error });
  }

  const permitsSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'permits')
    ? req.body.permits
    : noworker.permits;
  const certificationsSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'certifications')
    ? req.body.certifications
    : noworker.certifications;
  const workerPermits = normalizeWorkerPermitList(permitsSource);
  if (workerPermits.invalidPermits.length) {
    return res.status(400).json({
      error: `Unsupported permit type(s): ${workerPermits.invalidPermits.join(', ')}`,
      allowedPermitTypes: WORKER_PERMIT_TYPES,
    });
  }

  try {
    const updated = await updateWorker(
      req.params.id,
      {
        ...noworker,
        ...req.body,
        name: workerAccount.account.fullName,
        icPassport: nextIcPassport,
        employeeId: workerAccount.account.employeeId,
        role: req.body?.role || req.body?.position || noworker.role,
        email: workerAccount.account.email,
        company: req.body?.company || noworker.company || workerAccount.account.organization,
        permits: workerPermits.permits,
        certifications: certificationsSource,
        existingCertifications: noworker.certifications,
        status: isOwnerRequester ? 'submitted' : req.body?.status || noworker.status,
        reviewComment: isOwnerRequester ? '' : req.body?.reviewComment || noworker.reviewComment,
      },
      req.user,
    );
    if (isOwnerRequester && String(updated.status || '').toLowerCase() === 'submitted') {
      await safelyNotify('worker resubmitted', () => notifyWorkerSubmitted(updated, req.user));
    }
    return res.json(updated);
  } catch (e) {
    if (e instanceof Error && /Certification file/i.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Worker ID or IC/Passport already exists' });
    }
    throw e;
  }
});

app.patch('/api/workers/:id/status', authenticate, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Only admin may review worker profiles' });
  }

  const worker = await getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const status = normalizeString(req.body?.status);
  if (!['valid', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Worker review status must be valid or rejected' });
  }

  const reviewComment = status === 'rejected'
    ? normalizeString(req.body?.reviewComment || req.body?.comment)
    : '';
  const updated = await updateWorkerStatus(worker.id, status, reviewComment);
  const workerAccount = status === 'valid' ? await ensureApprovedWorkerAccount(updated) : null;
  await safelyNotify('worker reviewed', () => notifyWorkerReviewed(updated, req.user));
  if (workerAccount?.activationToken) {
    workerAccount.activationLink = buildActivationLink(req, workerAccount.activationToken);
    workerAccount.delivery = await deliverActivationInvite({
      worker: updated,
      user: workerAccount.user,
      activationLink: workerAccount.activationLink,
      activationExpiresAt: workerAccount.activationExpiresAt,
    });
  }
  return res.json(workerAccount ? { ...updated, workerAccount } : updated);
});

app.post('/api/workers/:id/activation-link', authenticate, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Only admin may resend worker activation links' });
  }

  const worker = await getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  if (String(worker.status || '').toLowerCase() !== 'valid') {
    return res.status(400).json({ error: 'Worker profile must be valid before activation link can be sent' });
  }

  const email = normalizeEmail(worker.email);
  if (!email) {
    return res.status(400).json({ error: 'Worker email is required before activation link can be sent' });
  }

  let user = await getUserByEmail(email);
  if (!user || user.role !== 'worker') {
    const workerAccount = await ensureApprovedWorkerAccount(worker);
    if (workerAccount.skipped) {
      return res.status(400).json({ error: workerAccount.reason });
    }
    const activationLink = buildActivationLink(req, workerAccount.activationToken);
    const delivery = await deliverActivationInvite({
      worker,
      user: workerAccount.user,
      activationLink,
      activationExpiresAt: workerAccount.activationExpiresAt,
    });
    return res.json({
      activationLink,
      activationExpiresAt: workerAccount.activationExpiresAt,
      delivery,
      user: workerAccount.user,
    });
  }

  await syncWorkerUserFromProfile(worker);
  const activation = await setUserActivationPending(user.id);
  user = await getUserById(user.id);

  const activationLink = buildActivationLink(req, activation.activationToken);
  const delivery = await deliverActivationInvite({
    worker,
    user: sanitizeUser(user),
    activationLink,
    activationExpiresAt: activation.activationExpiresAt,
  });

  res.json({
    activationLink,
    activationExpiresAt: activation.activationExpiresAt,
    delivery,
    user: sanitizeUser(user),
  });
});

app.get('/api/workers/:id/certifications/:certificationId/download', authenticate, async (req, res) => {
  const worker = await getWorkerById(req.params.id, pool, { includeAttachmentData: true });
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  if (!canViewWorker(req.user, worker)) {
    return res.status(403).json({ error: 'You are not allowed to access this worker certification' });
  }

  const certification = (worker.certifications || []).find(
    (item) => String(item.id) === String(req.params.certificationId),
  );

  if (!certification || (!certification.attachmentData && !certification.attachmentPath)) {
    return res.status(404).json({ error: 'Certification file not found' });
  }

  if (certification.attachmentPath) {
    const attachmentPath = resolveCertificationAttachmentPath(certification.attachmentPath);
    if (!attachmentPath || !fs.existsSync(attachmentPath)) {
      return res.status(404).json({ error: 'Certification file not found' });
    }
    res.setHeader('Content-Type', certification.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', buildContentDisposition(certification.fileName || 'certificate'));
    return res.sendFile(attachmentPath);
  }

  const buffer = Buffer.from(certification.attachmentData, 'base64');
  res.setHeader('Content-Type', certification.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', buildContentDisposition(certification.fileName || 'certificate'));
  res.setHeader('Content-Length', buffer.length);
  return res.send(buffer);
});

app.delete('/api/workers/:id', authenticate, async (req, res) => {
  const noworker = await getWorkerById(req.params.id);
  if (!noworker) return res.status(404).json({ error: 'Worker not found' });
  const isOwnerRequester = req.user.role === 'requester' && noworker.createdBy === req.user.id;

  if (!isAdmin(req.user) && !isOwnerRequester) {
    return res.status(403).json({ error: 'Only the requester owner or admin may delete this worker profile' });
  }

  if (isOwnerRequester && noworker.status === 'valid') {
    return res.status(403).json({ error: 'Approved worker profiles must be removed by Admin' });
  }

  await deleteWorker(req.params.id);
  return res.json({ status: 'deleted' });
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

  try {
    const permit = await insertPermit(req.body, req.user);
    return res.status(201).json(permit);
  } catch (e) {
    if (e instanceof Error && /permit document file|unsupported permit document/i.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }
});

app.patch('/api/permits/:id', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canUpdatePermitDetails(req.user, permit)) {
    return res.status(403).json({
      error: 'Only the requester owner can edit draft or rejected permits',
      currentStatus: permit.status,
    });
  }

  const { title, location, description, startDateTime, endDateTime } = req.body || {};

  if (!title || !location || !description || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'Missing permit information' });
  }

  try {
    const updatedPermit = await updatePermitDetails(permit, req.body, req.user);
    return res.json(updatedPermit);
  } catch (e) {
    if (e instanceof Error && /permit document file|unsupported permit document/i.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }
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

app.get('/api/permits/:id/documents/:documentId/download', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  const documents = await getStoredPermitDocuments(permit.id);
  const document = documents.find((item) => normalizeString(item.id) === normalizeString(req.params.documentId));

  if (!document || (!document.attachmentData && !document.attachmentPath)) {
    return res.status(404).json({ error: 'Permit document file not found' });
  }

  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', buildContentDisposition(document.fileName || document.name || 'permit-document'));

  if (document.attachmentPath) {
    const attachmentPath = resolvePermitDocumentAttachmentPath(document.attachmentPath);
    if (!attachmentPath || !fs.existsSync(attachmentPath)) {
      return res.status(404).json({ error: 'Permit document file not found' });
    }

    return res.sendFile(attachmentPath);
  }

  const buffer = Buffer.from(document.attachmentData, 'base64');
  return res.send(buffer);
});

app.get('/api/extension-requests', authenticate, async (req, res) => {
  const requests = await getExtensionRequestsForUser(req.user);
  return res.json({ count: requests.length, requests, data: requests });
});

app.post('/api/permits/:id/extension-requests', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  if (permit.status !== 'active') {
    return res.status(409).json({
      error: 'Extension requests can only be created for active work permits',
      currentStatus: permit.status,
    });
  }

  if (!canCreateExtensionRequest(req.user, permit)) {
    return res.status(403).json({
      error: 'Only assigned workers or supervisors can create an extension request',
    });
  }

  const requestedMinutes = Number(req.body?.requestedMinutes || req.body?.minutes);
  if (!Number.isFinite(requestedMinutes) || requestedMinutes < 15) {
    return res.status(400).json({ error: 'Requested extension time must be at least 15 minutes' });
  }

  const request = await insertExtensionRequest(permit, req.user, {
    requestedMinutes: Math.round(requestedMinutes),
    reason: req.body?.reason,
  });

  return res.status(201).json(request);
});

app.patch('/api/extension-requests/:id', authenticate, async (req, res) => {
  const request = await getExtensionRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: 'Extension request not found' });
  }

  if (!request.permit || !canViewPermit(req.user, request.permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this extension request' });
  }

  if (!canDecideExtensionRequest(req.user)) {
    return res.status(403).json({ error: 'Only Supervisor may approve or reject extension requests' });
  }

  if (request.status !== 'waiting') {
    return res.status(409).json({
      error: 'Extension request has already been decided',
      currentStatus: request.status,
    });
  }

  const status = normalizeString(req.body?.status).toLowerCase();
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const notes = normalizeString(req.body?.notes);
  if (status === 'rejected' && !notes) {
    return res.status(400).json({ error: 'Decision notes are required to reject an extension' });
  }

  const updated = await decideExtensionRequest(request, req.user, { status, notes });
  return res.json(updated);
});

app.post('/api/permits/:id/hse-review', authenticate, async (req, res) => {
  const permit = await getPermitById(req.params.id);

  if (!permit) {
    return res.status(404).json({ error: 'Permit not found' });
  }

  if (!canViewPermit(req.user, permit)) {
    return res.status(403).json({ error: 'You are not allowed to access this permit' });
  }

  if (!canRunHseReview(req.user)) {
    return res.status(403).json({
      error: 'Only the safety officer may run the Virtual HSE Safety Officer review',
      yourRole: req.user.role,
    });
  }

  const [activeRows] = await pool.execute(
    `
    SELECT *
    FROM permits
    WHERE id <> ?
      AND status IN ('approved', 'active')
  `,
    [permit.id],
  );
  const workers = await getAllWorkers();
  const evaluation = buildHseEvaluation({
    permit,
    workers,
    activePermits: activeRows.map(rowToPermit),
    evaluationStage: req.body?.evaluationStage || req.body?.evaluation_stage,
    siteValidation: req.body?.siteValidation || req.body?.site_validation || {},
  });
  const applyDecision = req.body?.applyDecision !== false;

  if (applyDecision) {
    const allowedStatuses =
      evaluation.evaluation_stage === 'Stage 2' ? ['stage1_complete', 'approved'] : ['submitted'];

    if (!allowedStatuses.includes(permit.status)) {
      return res.status(409).json({
        error: 'Permit is not in the correct workflow status for this HSE review stage',
        currentStatus: permit.status,
        allowedStatuses,
        evaluation,
      });
    }

    const nextStatus = mapHseDecisionToStatus(evaluation);
    const auditComment = [
      `Virtual HSE Safety Officer ${evaluation.evaluation_stage}: ${evaluation.decision}.`,
      evaluation.detailed_feedback,
    ].join(' ');

    if (nextStatus !== permit.status) {
      await updatePermitStatus(permit, nextStatus, req.user, auditComment);
    } else {
      await insertAuditLog({
        permitId: permit.id,
        actorUserId: req.user.id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'hse reviewed',
        fromStatus: permit.status,
        toStatus: permit.status,
        comment: auditComment,
      });
    }
  }

  return res.json(evaluation);
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

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Upload is too large. Permit document files must be 5 MB each or smaller.',
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }

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
