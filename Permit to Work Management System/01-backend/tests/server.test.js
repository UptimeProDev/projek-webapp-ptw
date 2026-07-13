const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "ptw_test";

const app = require("../../../server");

let dbAvailable = true;
let dbError;

test.before(async () => {
  try {
    await app.ready;
    await app.resetForTests();
  } catch (error) {
    dbAvailable = false;
    dbError = error;
  }
});

test.after(async () => {
  if (dbAvailable) {
    await app.closeDb();
  }
});

function requireDb(t) {
  if (!dbAvailable) {
    t.skip(`MySQL is not available: ${dbError.message}`);
  }
}

const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77,
  79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123,
  135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530,
  531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719,
  1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666,
  6667, 6668, 6669, 6697, 10080,
]);

function startTestServer() {
  return new Promise((resolve) => {
    function listen() {
      const server = app.listen(0, () => {
        const { port } = server.address();
        if (FETCH_BLOCKED_PORTS.has(port)) {
          server.close(listen);
          return;
        }
        resolve(server);
      });
    }

    listen();
  });
}

function serverUrl(server, path) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}${path}`;
}

async function requestJson(server, path, options = {}) {
  const response = await fetch(serverUrl(server, path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  return { response, body };
}

async function createSignedInUser(server) {
  const email = `tester-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;

  const result = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Test Requester",
      email,
      organization: "Global Engineering",
      role: "requester",
      password: "Permit123!",
      acceptTerms: true,
    }),
  });

  assert.equal(result.response.status, 201);
  assert.ok(result.body.token);
  assert.equal(result.body.user.email, email);

  return result.body;
}

async function loginDemoUser(server, login, password) {
  const result = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });

  assert.equal(result.response.status, 200);
  assert.ok(result.body.token);

  return result.body;
}

test("health endpoint returns service status", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const { response, body } = await requestJson(server, "/health");

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "ptw-backend");
});

test("root route serves the auth page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /PTW Guardian/);
});

test("login route serves the auth page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/login"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /id="loginForm"/);
});

test("admin can assign multiple application roles to one user", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const user = await createSignedInUser(server);
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");

  const safetySupervisor = await requestJson(server, `/api/users/${user.user.id}/roles`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ roles: ["safety_officer", "supervisor"] }),
  });

  assert.equal(safetySupervisor.response.status, 200);
  assert.deepEqual(safetySupervisor.body.user.roles, ["safety_officer", "supervisor"]);
  assert.equal(safetySupervisor.body.user.role, "safety_officer");

  const supervisorDashboard = await requestJson(server, "/api/approver/dashboard", {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  assert.equal(supervisorDashboard.response.status, 200);

  const adminSafety = await requestJson(server, `/api/users/${user.user.id}/roles`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ roles: ["admin", "safety_officer"] }),
  });

  assert.equal(adminSafety.response.status, 200);
  assert.deepEqual(adminSafety.body.user.roles, ["admin", "safety_officer"]);

  const userList = await requestJson(server, "/api/users", {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  assert.equal(userList.response.status, 200);
  assert.ok(Array.isArray(userList.body.users));
});

test("dashboard route serves the requester dashboard page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/dashboard"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Requester Dashboard/);
});

test("support route serves the support page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/support"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Submit Request/);
});

test("activate route serves the worker activation page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/activate"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Activate Account/);
});

test("safety route serves the safety officer lane page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/safety"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /ptw-guardian-login-v2\.png/);
  assert.match(body, /Safety Officer Dashboard/);
});

test("review route serves the supervisor review page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/review"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Supervisor Command Center/);
});

test("legacy approver route redirects to the supervisor page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/approver"), { redirect: "manual" });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/supervisor");
});

test("worker route serves the contractor worker portal page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/worker"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Contractor \/ Worker Flow/);
});

test("user can sign up and log in", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const signup = await createSignedInUser(server);

  const login = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      login: signup.user.email,
      password: "Permit123!",
    }),
  });

  assert.equal(login.response.status, 200);
  assert.ok(login.body.token);
  assert.equal(login.body.user.employeeId, signup.user.employeeId);
});

test("worker profiles must link to an existing registered worker account", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existingUserEmail = `linked-existing-${suffix}@example.com`;
  const existingProfileEmployeeId = `WL-${suffix.slice(-6)}`.toUpperCase();

  const workerSignup = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Linked Existing Worker",
      email: existingUserEmail,
      organization: "Global Engineering",
      role: "worker",
      password: "Permit123!",
      acceptTerms: true,
    }),
  });

  assert.equal(workerSignup.response.status, 201);
  assert.match(workerSignup.body.user.employeeId, /^W/);
  assert.notEqual(workerSignup.body.user.employeeId, existingProfileEmployeeId);

  const createExistingProfile = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Linked Existing Worker",
      icPassport: `IC-${suffix}`,
      employeeId: existingProfileEmployeeId,
      role: "General Worker",
      email: existingUserEmail,
      permits: ["Chemical Handling"],
    }),
  });

  assert.equal(createExistingProfile.response.status, 201);
  assert.equal(createExistingProfile.body.employeeId, workerSignup.body.user.employeeId);

  const syncedLogin = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      login: existingUserEmail,
      password: "Permit123!",
    }),
  });

  assert.equal(syncedLogin.response.status, 200);
  assert.equal(syncedLogin.body.user.employeeId, workerSignup.body.user.employeeId);

  const profileFirstEmail = `linked-profile-first-${suffix}@example.com`;
  const profileFirstEmployeeId = `WP-${suffix.slice(-6)}`.toUpperCase();
  const createProfileFirst = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Linked Profile First Worker",
      icPassport: `ICP-${suffix}`,
      employeeId: profileFirstEmployeeId,
      role: "General Worker",
      email: profileFirstEmail,
      permits: ["Chemical Handling"],
    }),
  });

  assert.equal(createProfileFirst.response.status, 400);
  assert.match(createProfileFirst.body.error, /must be registered/);

  const profileFirstSignup = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Linked Profile First Worker",
      email: profileFirstEmail,
      organization: "Global Engineering",
      role: "worker",
      password: "Permit123!",
      acceptTerms: true,
    }),
  });

  assert.equal(profileFirstSignup.response.status, 201);
  assert.match(profileFirstSignup.body.user.employeeId, /^W/);
  assert.notEqual(profileFirstSignup.body.user.employeeId, profileFirstEmployeeId);
});

test("supervisor command dashboard summarizes real routed permits", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const approver = await loginDemoUser(server, "approver@example.com", "approver12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const approverHeaders = {
    authorization: `Bearer ${approver.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Supervisor command center permit",
      workType: "Electrical Isolation",
      location: "Substation C-1",
      description: "Permit Type: Electrical Isolation\nSupervisor dashboard verification.",
      startDateTime: "2026-06-15T09:15:00+08:00",
      endDateTime: "2026-06-15T13:15:00+08:00",
      hazards: ["Electrical"],
      controls: ["LOTO isolation"],
      ppe: ["arc flash PPE"],
      approvers: ["Sam Supervisor", "Amir Approver"],
      assignedWorkers: [],
    }),
  });

  assert.equal(createResult.response.status, 201);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin routed to approval queue",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);

  const approveResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Supervisor verified for final release",
      }),
    },
  );

  assert.equal(approveResult.response.status, 200);

  const dashboardResult = await requestJson(server, "/api/approver/dashboard", {
    headers: approverHeaders,
  });

  assert.equal(dashboardResult.response.status, 200);
  assert.equal(dashboardResult.body.user.role, "approver");
  assert.ok(dashboardResult.body.stats.approvedPermits >= 1);
  assert.ok(
    dashboardResult.body.queue.some(
      (permit) =>
        permit.id === createResult.body.id &&
        permit.workflowStage === "Safety Verified" &&
        permit.stageTone === "verified",
    ),
  );

  const supervisorAttempt = await requestJson(server, "/api/approver/dashboard", {
    headers: supervisorHeaders,
  });

  assert.equal(supervisorAttempt.response.status, 200);
  assert.equal(supervisorAttempt.body.user.role, "supervisor");
});

test("demo admin account can log in", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const login = await loginDemoUser(server, "admin@example.com", "admin12345");

  assert.equal(login.user.role, "admin");
  assert.equal(login.user.email, "admin@example.com");
});

test("workflow notifications are stored and can be marked read", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };

  const permitResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: `Notification test permit ${Date.now()}`,
      workType: "General Maintenance",
      location: "Notification test area",
      description: "Permit Type: General Maintenance\nNotification persistence verification.",
      startDateTime: "2026-06-22T09:00:00+08:00",
      endDateTime: "2026-06-22T11:00:00+08:00",
      hazards: ["General Maintenance"],
      controls: ["Barricade"],
      ppe: ["Gloves"],
      approvers: ["Sam Supervisor"],
      assignedWorkers: [],
    }),
  });

  assert.equal(permitResult.response.status, 201);

  const notificationResult = await requestJson(server, "/api/notifications?limit=50", {
    headers: adminHeaders,
  });

  assert.equal(notificationResult.response.status, 200);
  const notification = notificationResult.body.notifications.find(
    (item) =>
      item.entityType === "permit" &&
      item.entityId === permitResult.body.id &&
      item.type === "permit_draft_created",
  );
  assert.ok(notification);
  assert.equal(notification.unread, true);

  const readResult = await requestJson(server, `/api/notifications/${notification.id}/read`, {
    method: "PATCH",
    headers: adminHeaders,
  });

  assert.equal(readResult.response.status, 200);
  assert.equal(readResult.body.unread, false);
  assert.ok(readResult.body.readAt);
});

test("admin can add and manage worker profiles", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const employeeId = `W-${Date.now()}`;
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const icPassport = `P-${Date.now()}`;
  const createCertData = Buffer.from("%PDF-1.4 hot work certificate").toString("base64");
  const updateCertData = Buffer.from("%PDF-1.4 fire watch certificate").toString("base64");

  const blockedRequesterCreate = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      name: "Requester Worker",
      icPassport: `${icPassport}-R`,
      employeeId: `${employeeId}-Q`,
    }),
  });

  assert.equal(blockedRequesterCreate.response.status, 403);
  assert.match(blockedRequesterCreate.body.error, /Only admin/);

  const blockedCreate = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: supervisorHeaders,
    body: JSON.stringify({
      name: "Supervisor Worker",
      icPassport: `${icPassport}-S`,
      employeeId: `${employeeId}-R`,
    }),
  });

  assert.equal(blockedCreate.response.status, 403);

  const aliAccount = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Ali Hassan",
      email: "ALI.HASSAN@example.com",
      organization: "ABC Contractor",
      role: "worker",
      password: "WorkerStrong000!",
      acceptTerms: true,
    }),
  });
  assert.equal(aliAccount.response.status, 201);

  const mismatchedWorkerAccount = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Ali Wrong Name",
      icPassport: `${icPassport}-M`,
      employeeId: `${employeeId}-M`,
      position: "Welder",
      email: "ALI.HASSAN@example.com",
      permits: ["Hot Work"],
    }),
  });
  assert.equal(mismatchedWorkerAccount.response.status, 400);
  assert.match(mismatchedWorkerAccount.body.error, /name and email must match/i);

  const createResult = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Ali Hassan",
      icPassport,
      employeeId,
      position: "Welder",
      phone: "+60 12-345 6789",
      email: "ALI.HASSAN@example.com",
      company: "ABC Contractor",
      permits: ["hot work", "Electrical"],
      certifications: [
        {
          type: "Hot Work",
          number: "HW-001",
          issuer: "NIOSH",
          issueDate: "2026-01-01",
          expiryDate: "2027-01-01",
          fileName: "hot-work-cert.pdf",
          mimeType: "application/pdf",
          attachmentData: createCertData,
        },
      ],
      status: "valid",
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.ok(createResult.body.id);
  assert.equal(createResult.body.status, "valid");
  assert.equal(createResult.body.createdBy, admin.user.id);
  assert.equal(createResult.body.createdByName, "PTW Admin");
  assert.equal(createResult.body.employeeId, aliAccount.body.user.employeeId);
  assert.equal(createResult.body.icPassport, icPassport);
  assert.equal(createResult.body.position, "Welder");
  assert.equal(createResult.body.phone, "+60 12-345 6789");
  assert.equal(createResult.body.email, "ali.hassan@example.com");
  assert.equal(createResult.body.company, "ABC Contractor");
  assert.equal(createResult.body.certifications.length, 1);
  assert.ok(createResult.body.certifications[0].id);
  assert.equal(createResult.body.certifications[0].type, "Hot Work");
  assert.equal(createResult.body.certifications[0].fileName, "hot-work-cert.pdf");
  assert.equal(createResult.body.certifications[0].mimeType, "application/pdf");
  assert.equal(createResult.body.certifications[0].hasAttachment, true);
  assert.equal("attachmentData" in createResult.body.certifications[0], false);
  assert.deepEqual(createResult.body.permits, ["Hot Work", "Electrical Isolation"]);

  const initialDownload = await fetch(
    serverUrl(
      server,
      `/api/workers/${createResult.body.id}/certifications/${createResult.body.certifications[0].id}/download`,
    ),
    {
      headers: adminHeaders,
    },
  );
  assert.equal(initialDownload.status, 200);
  assert.match(initialDownload.headers.get("content-type") || "", /application\/pdf/);
  assert.match(initialDownload.headers.get("content-disposition") || "", /hot-work-cert\.pdf/);
  assert.equal(
    Buffer.from(await initialDownload.arrayBuffer()).toString("utf8"),
    "%PDF-1.4 hot work certificate",
  );

  const listResult = await requestJson(server, "/api/workers", {
    headers: adminHeaders,
  });

  assert.equal(listResult.response.status, 200);
  const listedWorker = listResult.body.workers.find((worker) => worker.id === createResult.body.id);
  assert.ok(listedWorker);
  assert.equal(listedWorker.createdByName, "PTW Admin");
  assert.equal(listedWorker.createdByEmail, "admin@example.com");

  const deleteCandidateAccount = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Delete Candidate",
      email: "delete.candidate@example.com",
      organization: "ABC Contractor",
      role: "worker",
      password: "WorkerStrong000!",
      acceptTerms: true,
    }),
  });
  assert.equal(deleteCandidateAccount.response.status, 201);

  const deleteCandidateResult = await requestJson(server, "/api/workers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Delete Candidate",
      icPassport: `${icPassport}-D`,
      employeeId: `${employeeId}-D`,
      position: "Fire Watch",
      email: "delete.candidate@example.com",
      permits: ["Hot Work"],
    }),
  });
  assert.equal(deleteCandidateResult.response.status, 201);

  const adminDeleteCandidateResult = await requestJson(
    server,
    `/api/workers/${deleteCandidateResult.body.id}`,
    {
      method: "DELETE",
      headers: adminHeaders,
    },
  );
  assert.equal(adminDeleteCandidateResult.response.status, 200);
  assert.equal(adminDeleteCandidateResult.body.status, "deleted");

  const afterAdminDelete = await requestJson(server, "/api/workers", {
    headers: adminHeaders,
  });
  assert.equal(
    afterAdminDelete.body.workers.some((worker) => worker.id === deleteCandidateResult.body.id),
    false,
  );

  const invalidUpdateResult = await requestJson(server, `/api/workers/${createResult.body.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Ali Hassan",
      icPassport,
      employeeId,
      role: "Welder",
      permits: ["hod wort"],
      status: "valid",
    }),
  });

  assert.equal(invalidUpdateResult.response.status, 400);
  assert.match(invalidUpdateResult.body.error, /Unsupported permit type\(s\): hod wort/);
  assert.ok(invalidUpdateResult.body.allowedPermitTypes.includes("Hot Work"));

  const aliUpdatedAccount = await requestJson(server, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Ali Hassan Updated",
      email: "ali.updated@example.com",
      organization: "XYZ Contractor",
      role: "worker",
      password: "WorkerStrong123!",
      acceptTerms: true,
    }),
  });
  assert.equal(aliUpdatedAccount.response.status, 201);

  const updateResult = await requestJson(server, `/api/workers/${createResult.body.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Ali Hassan Updated",
      icPassport,
      employeeId,
      role: "Senior Welder",
      phone: "+60 19-222 3333",
      email: "ali.updated@example.com",
      company: "XYZ Contractor",
      permits: ["Hot Work"],
      reviewComment: "Updated by Admin",
      certifications: [
        {
          type: "Fire Watch",
          number: "FW-002",
          issuer: "Site HSE",
          issueDate: "2026-02-01",
          expiryDate: "2027-02-01",
          fileName: "fire-watch-cert.pdf",
          mimeType: "application/pdf",
          attachmentData: updateCertData,
        },
      ],
      status: "valid",
    }),
  });

  assert.equal(updateResult.response.status, 200);
  assert.equal(updateResult.body.name, "Ali Hassan Updated");
  assert.equal(updateResult.body.employeeId, aliUpdatedAccount.body.user.employeeId);
  assert.equal(updateResult.body.status, "valid");
  assert.equal(updateResult.body.reviewComment, "Updated by Admin");
  assert.equal(updateResult.body.phone, "+60 19-222 3333");
  assert.equal(updateResult.body.email, "ali.updated@example.com");
  assert.equal(updateResult.body.company, "XYZ Contractor");
  assert.equal(updateResult.body.certifications.length, 1);
  assert.ok(updateResult.body.certifications[0].id);
  assert.equal(updateResult.body.certifications[0].type, "Fire Watch");
  assert.equal(updateResult.body.certifications[0].fileName, "fire-watch-cert.pdf");
  assert.equal(updateResult.body.certifications[0].hasAttachment, true);
  assert.deepEqual(updateResult.body.permits, ["Hot Work"]);

  const updatedDownload = await fetch(
    serverUrl(
      server,
      `/api/workers/${createResult.body.id}/certifications/${updateResult.body.certifications[0].id}/download`,
    ),
    {
      headers: requesterHeaders,
    },
  );
  assert.equal(updatedDownload.status, 200);
  assert.equal(
    Buffer.from(await updatedDownload.arrayBuffer()).toString("utf8"),
    "%PDF-1.4 fire watch certificate",
  );

  const approveResult = await requestJson(server, `/api/workers/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "valid" }),
  });

  assert.equal(approveResult.response.status, 200);
  assert.equal(approveResult.body.status, "valid");
  assert.equal(approveResult.body.workerAccount.created, false);
  assert.equal(approveResult.body.workerAccount.activationRequired, false);
  assert.equal(approveResult.body.workerAccount.user.email, "ali.updated@example.com");
  assert.equal(approveResult.body.workerAccount.user.role, "worker");
  assert.equal(approveResult.body.workerAccount.user.employeeId, aliUpdatedAccount.body.user.employeeId);
  assert.equal(approveResult.body.workerAccount.user.accountStatus, "active");
  assert.equal(approveResult.body.workerAccount.activationLink, undefined);

  const requesterDeleteApprovedResult = await requestJson(
    server,
    `/api/workers/${createResult.body.id}`,
    {
      method: "DELETE",
      headers: requesterHeaders,
    },
  );
  assert.equal(requesterDeleteApprovedResult.response.status, 403);

  const workerLogin = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      login: "ali.updated@example.com",
      password: "WorkerStrong123!",
    }),
  });

  assert.equal(workerLogin.response.status, 200);
  assert.equal(workerLogin.body.user.role, "worker");

  const linkedPermitResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Worker history retention permit",
      workType: "Hot Work",
      location: "Plant 7",
      description: "Permit Type: Hot Work\nWorker deletion retention check.",
      startDateTime: "2026-06-26T08:00:00+08:00",
      endDateTime: "2026-06-26T12:00:00+08:00",
      hazards: ["Hot Work"],
      controls: ["Fire watch"],
      ppe: ["Gloves"],
      approvers: ["Sam Supervisor"],
      assignedWorkers: [createResult.body.id],
    }),
  });
  assert.equal(linkedPermitResult.response.status, 201);

  const deleteResult = await requestJson(server, `/api/workers/${createResult.body.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });

  assert.equal(deleteResult.response.status, 409);
  assert.match(deleteResult.body.error, /permit history/i);

  const deactivateResult = await requestJson(server, `/api/workers/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "inactive" }),
  });

  assert.equal(deactivateResult.response.status, 200);
  assert.equal(deactivateResult.body.status, "inactive");
  assert.equal(deactivateResult.body.reviewComment, "Deactivated by Admin");
  assert.equal(deactivateResult.body.workerAccount.user.accountStatus, "inactive");

  const inactiveSessionResult = await requestJson(server, "/api/auth/me", {
    headers: {
      authorization: `Bearer ${workerLogin.body.token}`,
    },
  });
  assert.equal(inactiveSessionResult.response.status, 401);

  const inactiveLogin = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      login: "ali.updated@example.com",
      password: "WorkerStrong123!",
    }),
  });
  assert.equal(inactiveLogin.response.status, 403);
  assert.equal(inactiveLogin.body.error, "Account deactivated, please contact the admin.");

  const reactivateProfileResult = await requestJson(server, `/api/workers/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "valid" }),
  });
  assert.equal(reactivateProfileResult.response.status, 200);
  assert.equal(reactivateProfileResult.body.status, "valid");
  assert.equal(reactivateProfileResult.body.workerAccount.user.accountStatus, "active");

  const reactivatedLogin = await requestJson(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      login: "ali.updated@example.com",
      password: "WorkerStrong123!",
    }),
  });
  assert.equal(reactivatedLogin.response.status, 200);
  assert.equal(reactivatedLogin.body.user.role, "worker");

  await requestJson(server, `/api/workers/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "inactive" }),
  });

  const finalList = await requestJson(server, "/api/workers", {
    headers: adminHeaders,
  });

  const inactiveWorker = finalList.body.workers.find((worker) => worker.id === createResult.body.id);
  assert.ok(inactiveWorker);
  assert.equal(inactiveWorker.status, "inactive");

  const requesterWorkerList = await requestJson(server, "/api/workers", {
    headers: requesterHeaders,
  });
  const inactiveRequesterWorker = requesterWorkerList.body.workers.find((worker) => worker.id === createResult.body.id);
  assert.ok(inactiveRequesterWorker);
  assert.equal(inactiveRequesterWorker.status, "inactive");

  const inactiveAssignmentResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Inactive worker assignment",
      workType: "Preventive Maintenance",
      location: "Plant 7",
      description: "Attempt to assign inactive worker.",
      startDateTime: "2026-06-26T13:00:00+08:00",
      endDateTime: "2026-06-26T15:00:00+08:00",
      hazards: ["Hot Work"],
      controls: ["Permit controls"],
      ppe: ["Hard hat"],
      approvers: ["PTW Admin"],
      documents: [
        {
          type: "MOS",
          name: "MOS digital form",
          structuredData: { workTitle: "Inactive worker assignment" },
        },
        {
          type: "JSA",
          name: "JSA digital form",
          structuredData: { taskStep: "Inactive worker assignment" },
        },
      ],
      assignedWorkers: [createResult.body.id],
    }),
  });
  assert.equal(inactiveAssignmentResult.response.status, 400);
  assert.match(inactiveAssignmentResult.body.error, /Inactive worker cannot be assigned/i);
});

test("permit can be created, admin-submitted, and audited", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const unauthorized = await requestJson(server, "/api/permits");
  assert.equal(unauthorized.response.status, 401);

  const signup = await createSignedInUser(server);
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const authHeaders = {
    authorization: `Bearer ${signup.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const documentData = Buffer.from("%PDF-1.4 permit method statement").toString("base64");

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Hot work on pump skid",
      location: "Plant 1 - Area B",
      description: "Welding support bracket near pump skid.",
      startDateTime: "2026-06-01T08:00:00+08:00",
      endDateTime: "2026-06-01T12:00:00+08:00",
      hazards: ["fire", "hot surface"],
      controls: ["fire watch", "gas test"],
      ppe: ["gloves", "face shield"],
      approvers: ["supervisor1"],
      documents: [
        {
          type: "MOS",
          name: "method-statement.pdf",
          fileName: "method-statement.pdf",
          mimeType: "application/pdf",
          attachmentData: documentData,
        },
      ],
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.body.status, "draft");
  assert.equal(createResult.body.requestedBy, signup.user.fullName);
  assert.ok(createResult.body.id);
  assert.equal(createResult.body.documents.length, 1);
  assert.ok(createResult.body.documents[0].id);
  assert.equal(createResult.body.documents[0].hasAttachment, true);
  assert.equal("attachmentData" in createResult.body.documents[0], false);

  const documentDownload = await fetch(
    serverUrl(
      server,
      `/api/permits/${createResult.body.id}/documents/${createResult.body.documents[0].id}/download`,
    ),
    {
      headers: adminHeaders,
    },
  );
  assert.equal(documentDownload.status, 200);
  assert.match(documentDownload.headers.get("content-type") || "", /application\/pdf/);
  assert.match(documentDownload.headers.get("content-disposition") || "", /method-statement\.pdf/);
  assert.equal(
    Buffer.from(await documentDownload.arrayBuffer()).toString("utf8"),
    "%PDF-1.4 permit method statement",
  );

  const requesterSubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Ready for supervisor review",
      }),
    },
  );

  assert.equal(requesterSubmitAttempt.response.status, 403);
  assert.match(requesterSubmitAttempt.body.error, /Admin Lane 2/);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted after Lane 2 draft review",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const auditResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/audit-logs`,
    { headers: authHeaders },
  );

  assert.equal(auditResult.response.status, 200);
  assert.equal(auditResult.body.count, 2);
});

test("MOS and JSA Excel template can be imported and saved as digital permit documents", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const signup = await createSignedInUser(server);
  const authHeaders = {
    authorization: `Bearer ${signup.token}`,
  };

  const templateResponse = await fetch(serverUrl(server, "/api/permit-document-templates/mos-jsa.xlsx"), {
    headers: authHeaders,
  });
  assert.equal(templateResponse.status, 200);
  assert.match(
    templateResponse.headers.get("content-type") || "",
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await templateResponse.arrayBuffer()));
  workbook.getWorksheet("MOS").getCell("C2").value = "Pump skid preventive maintenance";
  workbook.getWorksheet("MOS").getCell("C4").value = "Inspect pump\nReplace worn seal\nTest run";
  workbook.getWorksheet("JSA").getCell("C2").value = "Mechanical maintenance";
  workbook.getWorksheet("JSA").getCell("C5").value = "Barricade area\nVerify isolation";

  const completedTemplate = Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
  const importResult = await requestJson(server, "/api/permit-document-templates/mos-jsa/import", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      fileName: "completed-mos-jsa.xlsx",
      attachmentData: completedTemplate,
    }),
  });

  assert.equal(importResult.response.status, 200);
  assert.equal(importResult.body.documents.length, 2);
  assert.equal(importResult.body.documents[0].type, "MOS");
  assert.equal(importResult.body.documents[0].structuredData.workTitle, "Pump skid preventive maintenance");
  assert.equal(importResult.body.documents[1].type, "JSA");
  assert.equal(importResult.body.documents[1].structuredData.taskStep, "Mechanical maintenance");

  const exportResponse = await fetch(serverUrl(server, "/api/permit-document-templates/mos-jsa/export"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ documents: importResult.body.documents }),
  });
  assert.equal(exportResponse.status, 200);
  const exportedWorkbook = new ExcelJS.Workbook();
  await exportedWorkbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
  assert.equal(exportedWorkbook.getWorksheet("MOS").getCell("C2").value, "Pump skid preventive maintenance");
  assert.equal(exportedWorkbook.getWorksheet("JSA").getCell("C5").value, "Barricade area\nVerify isolation");

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Pump skid preventive maintenance",
      workType: "Preventive Maintenance",
      location: "Plant 1 - Area B",
      description: "Preventive maintenance for pump skid.",
      startDateTime: "2026-06-01T08:00:00+08:00",
      endDateTime: "2026-06-01T12:00:00+08:00",
      hazards: ["Preventive Maintenance"],
      controls: ["barricade"],
      ppe: ["Hard hat", "Safety boots"],
      approvers: ["PTW Admin"],
      documents: importResult.body.documents,
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.body.documents.length, 2);
  assert.equal(createResult.body.documents[0].source, "mos-jsa-digital-form");
  assert.equal(createResult.body.documents[0].structuredData.workTitle, "Pump skid preventive maintenance");
  assert.equal(createResult.body.documents[1].structuredData.controlMeasures, "Barricade area\nVerify isolation");
});

test("requester can edit drafts while Admin Lane 2 submits normal permits", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Draft to revise",
      location: "Plant 2",
      description: "Initial draft.",
      startDateTime: "2026-06-03T08:00:00+08:00",
      endDateTime: "2026-06-03T12:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch"],
      ppe: ["gloves"],
      approvers: ["supervisor@example.com"],
    }),
  });

  assert.equal(createResult.response.status, 201);

  const updateDraft = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Updated draft scope",
      location: "Plant 2 - Area C",
      description: "Permit Type: Hot Work\n\nUpdated requester scope.",
      startDateTime: "2026-06-03T09:00:00+08:00",
      endDateTime: "2026-06-03T13:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch", "gas test"],
      ppe: ["gloves", "face shield"],
      approvers: ["supervisor@example.com"],
    }),
  });

  assert.equal(updateDraft.response.status, 200);
  assert.equal(updateDraft.body.title, "Updated draft scope");

  const requesterSubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Ready for review",
      }),
    },
  );

  assert.equal(requesterSubmitAttempt.response.status, 403);
  assert.match(requesterSubmitAttempt.body.error, /Admin Lane 2/);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted after Lane 2 draft review",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const rejectResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "rejected",
        comment: "Revise controls",
      }),
    },
  );

  assert.equal(rejectResult.response.status, 200);
  assert.equal(rejectResult.body.status, "rejected");

  const unchangedRevisionAttempt = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Updated draft scope",
      location: "Plant 2 - Area C",
      description: "Permit Type: Hot Work\n\nUpdated requester scope.",
      startDateTime: "2026-06-03T09:00:00+08:00",
      endDateTime: "2026-06-03T13:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch", "gas test"],
      ppe: ["gloves", "face shield"],
      approvers: ["supervisor@example.com"],
    }),
  });

  assert.equal(unchangedRevisionAttempt.response.status, 409);
  assert.match(unchangedRevisionAttempt.body.error, /Change at least one/);

  const metadataOnlyRevisionAttempt = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Updated draft scope",
      workType: "Hot Work",
      location: "Plant 2 - Area C",
      description:
        "Permit Class: Normal\nReview Route: Admin Lane 2 -> Safety Officer\nPermit Type: Hot Work\nAssigned Workers: -\nAssigned Worker IDs: -\n\nUpdated requester scope.",
      startDateTime: "2026-06-03T09:00:00+08:00",
      endDateTime: "2026-06-03T13:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch", "gas test"],
      ppe: ["gloves", "face shield"],
      approvers: ["supervisor@example.com"],
      assignedWorkers: [],
      isEmergency: false,
    }),
  });

  assert.equal(metadataOnlyRevisionAttempt.response.status, 409);
  assert.match(metadataOnlyRevisionAttempt.body.error, /Change at least one/);

  const earlyAdminResubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin resubmitted before requester correction",
      }),
    },
  );

  assert.equal(earlyAdminResubmitAttempt.response.status, 409);
  assert.match(earlyAdminResubmitAttempt.body.error, /Requester must revise/);

  const reviseResult = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Revised controls attached",
      location: "Plant 2 - Area C",
      description: "Permit Type: Hot Work\n\nRevised controls after rejection.",
      startDateTime: "2026-06-03T09:00:00+08:00",
      endDateTime: "2026-06-03T13:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch", "gas test", "area barricade"],
      ppe: ["gloves", "face shield"],
      approvers: ["supervisor@example.com"],
    }),
  });

  assert.equal(reviseResult.response.status, 200);
  assert.equal(reviseResult.body.title, "Revised controls attached");
  assert.equal(reviseResult.body.status, "resubmitted");

  const requesterResubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Resubmitted after revision",
      }),
    },
  );

  assert.equal(requesterResubmitAttempt.response.status, 403);
  assert.match(requesterResubmitAttempt.body.error, /Admin Lane 2/);

  const resubmitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin resubmitted after requester correction",
      }),
    },
  );

  assert.equal(resubmitResult.response.status, 200);
  assert.equal(resubmitResult.body.status, "submitted");
});

test("admin can view and approve submitted requester permits", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Admin approval queue permit",
      location: "Requester Area 4",
      description: "Permit Type: Hot Work\n\nSubmitted for admin approval.",
      startDateTime: "2026-06-04T08:00:00+08:00",
      endDateTime: "2026-06-04T12:00:00+08:00",
      hazards: ["hot work"],
      controls: ["fire watch"],
      ppe: ["gloves"],
      approvers: ["admin@example.com"],
    }),
  });

  assert.equal(createResult.response.status, 201);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted after Lane 2 draft review",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const adminQueue = await requestJson(server, "/api/permits", {
    headers: adminHeaders,
  });

  assert.equal(adminQueue.response.status, 200);
  assert.ok(adminQueue.body.permits.some((permit) => permit.id === createResult.body.id));

  const approveResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Approved by admin",
      }),
    },
  );

  assert.equal(approveResult.response.status, 200);
  assert.equal(approveResult.body.status, "approved");
});

test("permit status changes are restricted by role", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const worker = await loginDemoUser(server, "worker@example.com", "worker12345");
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const workerHeaders = {
    authorization: `Bearer ${worker.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };

  const supervisorCreateAttempt = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: supervisorHeaders,
    body: JSON.stringify({
      title: "Supervisor should not create",
      location: "Plant 1",
      description: "This should be blocked.",
      startDateTime: "2026-06-01T08:00:00+08:00",
      endDateTime: "2026-06-01T12:00:00+08:00",
    }),
  });

  assert.equal(supervisorCreateAttempt.response.status, 403);

  const workerCreateAttempt = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: workerHeaders,
    body: JSON.stringify({
      title: "Worker should not create",
      location: "Plant 1",
      description: "Workers can only act on assigned permits.",
      startDateTime: "2026-06-01T08:00:00+08:00",
      endDateTime: "2026-06-01T12:00:00+08:00",
    }),
  });

  assert.equal(workerCreateAttempt.response.status, 403);
  assert.match(worker.user.employeeId, /^W/);

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Confined space inspection",
      location: "Tank Farm - Vessel 4",
      description: "Inspection before maintenance team entry.",
      startDateTime: "2026-06-02T08:00:00+08:00",
      endDateTime: "2026-06-02T14:00:00+08:00",
      hazards: ["oxygen deficiency"],
      controls: ["gas test", "standby person"],
      ppe: ["respirator"],
      approvers: ["supervisor@example.com"],
    }),
  });

  assert.equal(createResult.response.status, 201);

  const requesterSubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Ready for review",
      }),
    },
  );

  assert.equal(requesterSubmitAttempt.response.status, 403);
  assert.match(requesterSubmitAttempt.body.error, /Admin Lane 2/);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted after Lane 2 draft review",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const requesterApproveAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Trying to approve my own permit",
      }),
    },
  );

  assert.equal(requesterApproveAttempt.response.status, 403);

  const supervisorApproveResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Supervisor approval complete",
      }),
    },
  );

  assert.equal(supervisorApproveResult.response.status, 200);
  assert.equal(supervisorApproveResult.body.status, "approved");
});

test("Permit Approval can be completed by supervisor or safety officer", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(server, "requester@example.com", "requester12345");
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const supervisor = await loginDemoUser(server, "supervisor@example.com", "supervisor12345");
  const safety = await loginDemoUser(server, "safety@example.com", "safety12345");

  const requesterHeaders = { authorization: `Bearer ${requester.token}` };
  const adminHeaders = { authorization: `Bearer ${admin.token}` };
  const supervisorHeaders = { authorization: `Bearer ${supervisor.token}` };
  const safetyHeaders = { authorization: `Bearer ${safety.token}` };

  async function createSubmittedPermit(title) {
    const createResult = await requestJson(server, "/api/permits", {
      method: "POST",
      headers: requesterHeaders,
      body: JSON.stringify({
        title,
        workType: "Preventive Maintenance",
        location: "Plant 1",
        description: "Routine preventive maintenance.",
        startDateTime: "2026-06-02T08:00:00+08:00",
        endDateTime: "2026-06-02T14:00:00+08:00",
        hazards: ["Preventive Maintenance"],
        controls: ["barricade"],
        ppe: ["Hard hat"],
        approvers: ["PTW Admin"],
      }),
    });
    assert.equal(createResult.response.status, 201);

    const submitResult = await requestJson(server, `/api/permits/${createResult.body.id}/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted after Lane 2 draft review",
      }),
    });
    assert.equal(submitResult.response.status, 200);

    const mosApprovalResult = await requestJson(server, `/api/permits/${createResult.body.id}/status`, {
      method: "PATCH",
      headers: safetyHeaders,
      body: JSON.stringify({
        status: "stage1_complete",
        comment: "Safety Officer approved MOS Approval",
      }),
    });
    assert.equal(mosApprovalResult.response.status, 200);
    assert.equal(mosApprovalResult.body.status, "stage1_complete");

    return createResult.body.id;
  }

  const supervisorPermitId = await createSubmittedPermit("Supervisor Permit Approval");
  const siteValidationResult = await requestJson(server, `/api/permits/${supervisorPermitId}/site-validation`, {
    method: "PATCH",
    headers: supervisorHeaders,
    body: JSON.stringify({
      siteValidation: {
        "hot-work": {
          checked: {
            "fire-watch-assigned": true,
          },
          notes: "Fire watch positioned at north access.",
          updatedAt: "2026-07-01T01:00:00.000Z",
        },
      },
    }),
  });
  assert.equal(siteValidationResult.response.status, 200);
  assert.equal(siteValidationResult.body.siteValidation["hot-work"].notes, "Fire watch positioned at north access.");

  const siteValidationReadback = await requestJson(server, `/api/permits/${supervisorPermitId}`, {
    headers: supervisorHeaders,
  });
  assert.equal(siteValidationReadback.response.status, 200);
  assert.equal(siteValidationReadback.body.siteValidation["hot-work"].notes, "Fire watch positioned at north access.");

  const requesterAttempt = await requestJson(server, `/api/permits/${supervisorPermitId}/status`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      status: "approved",
      comment: "Requester trying to complete Permit Approval",
    }),
  });
  assert.equal(requesterAttempt.response.status, 403);
  assert.match(requesterAttempt.body.error, /supervisor or safety officer/i);

  const supervisorApproval = await requestJson(server, `/api/permits/${supervisorPermitId}/status`, {
    method: "PATCH",
    headers: supervisorHeaders,
    body: JSON.stringify({
      status: "approved",
      comment: "Supervisor approved Permit Approval",
    }),
  });
  assert.equal(supervisorApproval.response.status, 200);
  assert.equal(supervisorApproval.body.status, "approved");

  const safetyPermitId = await createSubmittedPermit("Safety Permit Approval");
  const safetyApproval = await requestJson(server, `/api/permits/${safetyPermitId}/status`, {
    method: "PATCH",
    headers: safetyHeaders,
    body: JSON.stringify({
      status: "approved",
      comment: "Safety Officer approved Permit Approval",
    }),
  });
  assert.equal(safetyApproval.response.status, 200);
  assert.equal(safetyApproval.body.status, "approved");
});

test("expired approved permits cannot be released for work", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(server, "requester@example.com", "requester12345");
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const supervisor = await loginDemoUser(server, "supervisor@example.com", "supervisor12345");

  const requesterHeaders = { authorization: `Bearer ${requester.token}` };
  const adminHeaders = { authorization: `Bearer ${admin.token}` };
  const supervisorHeaders = { authorization: `Bearer ${supervisor.token}` };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Expired release window",
      workType: "Corrective Maintenance",
      location: "Main Plant Alpha",
      description: "Expired final release should be blocked.",
      startDateTime: "2026-06-01T08:00:00+08:00",
      endDateTime: "2026-06-01T12:00:00+08:00",
      hazards: ["Hot Work"],
      controls: ["fire watch"],
      ppe: ["Hard hat"],
      approvers: ["Sam Supervisor"],
    }),
  });
  assert.equal(createResult.response.status, 201);

  const submitResult = await requestJson(server, `/api/permits/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      status: "submitted",
      comment: "Admin submitted expired test permit",
    }),
  });
  assert.equal(submitResult.response.status, 200);

  const approveResult = await requestJson(server, `/api/permits/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: supervisorHeaders,
    body: JSON.stringify({
      status: "approved",
      comment: "Supervisor approved Permit Approval",
    }),
  });
  assert.equal(approveResult.response.status, 200);
  assert.equal(approveResult.body.status, "approved");

  const activateResult = await requestJson(server, `/api/permits/${createResult.body.id}/status`, {
    method: "PATCH",
    headers: supervisorHeaders,
    body: JSON.stringify({
      status: "active",
      comment: "Attempting to release expired permit",
    }),
  });
  assert.equal(activateResult.response.status, 409);
  assert.match(activateResult.body.error, /expired/i);
});

test("assigned worker can view and close an active permit", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const worker = await loginDemoUser(server, "worker@example.com", "worker12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const workerHeaders = {
    authorization: `Bearer ${worker.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Worker assigned hot work",
      workType: "Hot Work",
      location: "Main Plant Alpha",
      description: "Permit Type: Hot Work\n\nAssigned worker completion flow.",
      startDateTime: "2026-07-07T08:00:00+08:00",
      endDateTime: "2026-07-07T12:00:00+08:00",
      hazards: ["Hot Work"],
      controls: ["fire watch"],
      ppe: ["face shield"],
      approvers: ["Sam Supervisor"],
      assignedWorkers: ["W01", "W01"],
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.deepEqual(createResult.body.assignedWorkers, ["W01"]);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin routed to supervisor",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);

  const approveResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Supervisor approved",
      }),
    },
  );

  assert.equal(approveResult.response.status, 200);

  const activateResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "active",
        comment: "Supervisor final approval activated",
      }),
    },
  );

  assert.equal(activateResult.response.status, 200);
  assert.equal(activateResult.body.status, "active");

  const workerQueue = await requestJson(server, "/api/permits", {
    headers: workerHeaders,
  });

  assert.equal(workerQueue.response.status, 200);
  assert.ok(workerQueue.body.permits.some((permit) => permit.id === createResult.body.id));

  const extensionCreate = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/extension-requests`,
    {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        requestedMinutes: 45,
        reason: "Additional insulation checks required",
      }),
    },
  );

  assert.equal(extensionCreate.response.status, 201);
  assert.equal(extensionCreate.body.status, "waiting");
  assert.equal(extensionCreate.body.permitId, createResult.body.id);

  const supervisorExtensions = await requestJson(server, "/api/extension-requests", {
    headers: supervisorHeaders,
  });

  assert.equal(supervisorExtensions.response.status, 200);
  assert.ok(
    supervisorExtensions.body.requests.some(
      (request) =>
        request.requestId === extensionCreate.body.requestId &&
        request.permitId === createResult.body.id &&
        request.status === "waiting",
    ),
  );

  const extensionApprove = await requestJson(
    server,
    `/api/extension-requests/${extensionCreate.body.requestId}`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "approved",
        notes: "Extension controls verified",
      }),
    },
  );

  assert.equal(extensionApprove.response.status, 200);
  assert.equal(extensionApprove.body.status, "approved");
  assert.equal(
    new Date(extensionApprove.body.permit.endDateTime).toISOString(),
    new Date("2026-07-07T12:45:00+08:00").toISOString(),
  );

  const extendedPermit = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    headers: workerHeaders,
  });

  assert.equal(extendedPermit.response.status, 200);
  assert.equal(
    new Date(extendedPermit.body.endDateTime).toISOString(),
    new Date("2026-07-07T12:45:00+08:00").toISOString(),
  );

  const workerExtensions = await requestJson(server, "/api/extension-requests", {
    headers: workerHeaders,
  });

  assert.equal(workerExtensions.response.status, 200);
  assert.ok(
    workerExtensions.body.requests.some(
      (request) =>
        request.requestId === extensionCreate.body.requestId && request.status === "approved",
    ),
  );

  const closeResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: workerHeaders,
      body: JSON.stringify({
        status: "closed",
        comment: "Closed by assigned worker",
      }),
    },
  );

  assert.equal(closeResult.response.status, 200);
  assert.equal(closeResult.body.status, "closed");
});

test("emergency permits are routed to safety officer review", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");
  const safetyOfficer = await loginDemoUser(server, "safety@example.com", "safety12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };
  const safetyHeaders = {
    authorization: `Bearer ${safetyOfficer.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Emergency steam leak isolation",
      location: "Boiler House",
      description:
        "Permit Class: Emergency\nReview Route: Safety Officer\nPermit Type: General Maintenance\n\nUrgent isolation for steam leak.",
      startDateTime: "2026-06-04T08:00:00+08:00",
      endDateTime: "2026-06-04T10:00:00+08:00",
      hazards: [],
      controls: ["area barricade", "safety officer notified"],
      ppe: ["face shield", "gloves"],
      approvers: ["Sarah Safety"],
      isEmergency: true,
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.body.isEmergency, true);
  assert.ok(createResult.body.hazards.includes("Emergency"));
  assert.equal(createResult.body.status, "draft");

  const adminDraftQueue = await requestJson(server, "/api/permits", {
    headers: adminHeaders,
  });
  assert.equal(adminDraftQueue.response.status, 200);
  assert.equal(
    adminDraftQueue.body.permits.some((permit) => permit.id === createResult.body.id),
    false,
  );

  const safetyDraftQueue = await requestJson(server, "/api/permits", {
    headers: safetyHeaders,
  });
  assert.equal(safetyDraftQueue.response.status, 200);
  assert.equal(
    safetyDraftQueue.body.permits.some((permit) => permit.id === createResult.body.id),
    false,
  );

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Emergency permit submitted directly to safety officer",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const adminSubmittedQueue = await requestJson(server, "/api/permits", {
    headers: adminHeaders,
  });
  assert.equal(adminSubmittedQueue.response.status, 200);
  assert.equal(
    adminSubmittedQueue.body.permits.some((permit) => permit.id === createResult.body.id),
    false,
  );

  const supervisorQueue = await requestJson(server, "/api/permits", {
    headers: supervisorHeaders,
  });
  assert.equal(supervisorQueue.response.status, 200);
  assert.equal(
    supervisorQueue.body.permits.some((permit) => permit.id === createResult.body.id),
    false,
  );

  const safetyQueue = await requestJson(server, "/api/permits", {
    headers: safetyHeaders,
  });
  assert.equal(safetyQueue.response.status, 200);
  assert.ok(safetyQueue.body.permits.some((permit) => permit.id === createResult.body.id));

  const supervisorApproveAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: supervisorHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Supervisor should not approve emergency permit",
      }),
    },
  );

  assert.equal(supervisorApproveAttempt.response.status, 403);

  const safetyApproveResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: safetyHeaders,
      body: JSON.stringify({
        status: "approved",
        comment: "Safety officer approval complete",
      }),
    },
  );

  assert.equal(safetyApproveResult.response.status, 200);
  assert.equal(safetyApproveResult.body.status, "approved");
});

test("requester can revise and resubmit rejected emergency permit", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const safetyOfficer = await loginDemoUser(server, "safety@example.com", "safety12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const safetyHeaders = {
    authorization: `Bearer ${safetyOfficer.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Emergency compressor isolation",
      workType: "General Maintenance",
      location: "Compressor Deck",
      description:
        "Permit Class: Emergency\nReview Route: Safety Officer\nPermit Type: General Maintenance\n\nUrgent compressor isolation.",
      startDateTime: "2026-06-09T08:00:00+08:00",
      endDateTime: "2026-06-09T10:00:00+08:00",
      hazards: ["Emergency"],
      controls: ["area barricade"],
      ppe: ["gloves"],
      approvers: ["Sarah Safety"],
      isEmergency: true,
    }),
  });

  assert.equal(createResult.response.status, 201);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Emergency submitted to safety",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const rejectResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: safetyHeaders,
      body: JSON.stringify({
        status: "rejected",
        comment: "Add corrected emergency controls",
      }),
    },
  );

  assert.equal(rejectResult.response.status, 200);
  assert.equal(rejectResult.body.status, "rejected");

  const unchangedResubmitAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Emergency resubmitted without correction",
      }),
    },
  );

  assert.equal(unchangedResubmitAttempt.response.status, 409);
  assert.match(unchangedResubmitAttempt.body.error, /must revise/i);

  const reviseResult = await requestJson(server, `/api/permits/${createResult.body.id}`, {
    method: "PATCH",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Emergency compressor isolation revised",
      workType: "General Maintenance",
      location: "Compressor Deck",
      description:
        "Permit Class: Emergency\nReview Route: Safety Officer\nPermit Type: General Maintenance\n\nUrgent compressor isolation with corrected controls.",
      startDateTime: "2026-06-09T08:00:00+08:00",
      endDateTime: "2026-06-09T10:00:00+08:00",
      hazards: ["Emergency"],
      controls: ["area barricade", "safety officer notified"],
      ppe: ["gloves"],
      approvers: ["Sarah Safety"],
      isEmergency: true,
    }),
  });

  assert.equal(reviseResult.response.status, 200);
  assert.equal(reviseResult.body.title, "Emergency compressor isolation revised");
  assert.equal(reviseResult.body.status, "resubmitted");

  const resubmitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: requesterHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Emergency correction resubmitted to safety",
      }),
    },
  );

  assert.equal(resubmitResult.response.status, 200);
  assert.equal(resubmitResult.body.status, "submitted");
});

test("virtual HSE safety officer returns incomplete MOS Approval permit for correction", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const safetyOfficer = await loginDemoUser(server, "safety@example.com", "safety12345");
  const admin = await loginDemoUser(server, "admin@example.com", "admin12345");

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const safetyHeaders = {
    authorization: `Bearer ${safetyOfficer.token}`,
  };
  const adminHeaders = {
    authorization: `Bearer ${admin.token}`,
  };

  const createResult = await requestJson(server, "/api/permits", {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      title: "Incomplete hot work methodology",
      workType: "Hot Work",
      location: "Main Plant Alpha",
      description: "Permit Type: Hot Work\n\nWelding bracket without full methodology package.",
      startDateTime: "2026-06-06T08:00:00+08:00",
      endDateTime: "2026-06-06T12:00:00+08:00",
      hazards: ["Hot Work"],
      controls: ["Fire watch assigned"],
      ppe: ["Face shield"],
      approvers: ["Sarah Safety"],
      documents: [{ type: "JSA", name: "hot-work-jsa.pdf" }],
      assignedWorkers: [],
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.body.workType, "Hot Work");
  assert.deepEqual(createResult.body.documents, [
    { type: "JSA", name: "hot-work-jsa.pdf" },
  ]);

  const submitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/status`,
    {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "submitted",
        comment: "Admin submitted to HSE methodology review",
      }),
    },
  );

  assert.equal(submitResult.response.status, 200);
  assert.equal(submitResult.body.status, "submitted");

  const adminReviewAttempt = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/hse-review`,
    {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ evaluationStage: "MOS Approval" }),
    },
  );

  assert.equal(adminReviewAttempt.response.status, 403);
  assert.match(adminReviewAttempt.body.error, /Only the safety officer/);

  const reviewResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}/hse-review`,
    {
      method: "POST",
      headers: safetyHeaders,
      body: JSON.stringify({ evaluationStage: "MOS Approval" }),
    },
  );

  assert.equal(reviewResult.response.status, 200);
  assert.equal(reviewResult.body.evaluation_stage, "MOS Approval");
  assert.equal(reviewResult.body.decision, "Return for Correction");
  assert.equal(reviewResult.body.next_workflow_step, "Return/Draft");
  assert.ok(
    reviewResult.body.flags_detected.some((flag) =>
      flag.includes("Method Statement"),
    ),
  );

  const permitResult = await requestJson(
    server,
    `/api/permits/${createResult.body.id}`,
    { headers: requesterHeaders },
  );

  assert.equal(permitResult.response.status, 200);
  assert.equal(permitResult.body.status, "rejected");
  assert.match(permitResult.body.latestRejectionReason, /Virtual HSE Safety Officer MOS Approval/);
  assert.match(permitResult.body.latestRejectionReason, /returned for correction/i);
  assert.equal(permitResult.body.latestRejectionByRole, "safety_officer");

  const adminPermitList = await requestJson(server, "/api/permits", {
    headers: adminHeaders,
  });

  assert.equal(adminPermitList.response.status, 200);
  const adminRejectedPermit = adminPermitList.body.permits.find(
    (permit) => permit.id === createResult.body.id,
  );
  assert.match(adminRejectedPermit.latestRejectionReason, /Virtual HSE Safety Officer MOS Approval/);
});

test("contractor dashboard API is restricted to requester role", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const requester = await loginDemoUser(
    server,
    "requester@example.com",
    "requester12345",
  );
  const supervisor = await loginDemoUser(
    server,
    "supervisor@example.com",
    "supervisor12345",
  );

  const requesterResult = await requestJson(server, "/api/requester/dashboard", {
    headers: {
      authorization: `Bearer ${requester.token}`,
    },
  });

  assert.equal(requesterResult.response.status, 200);
  assert.equal(requesterResult.body.user.role, "requester");
  assert.ok(requesterResult.body.stats);

  const supervisorResult = await requestJson(server, "/api/requester/dashboard", {
    headers: {
      authorization: `Bearer ${supervisor.token}`,
    },
  });

  assert.equal(supervisorResult.response.status, 403);
});
