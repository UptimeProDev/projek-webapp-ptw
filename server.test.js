const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "ptw_test";

const app = require("./server");

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

function startTestServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
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

test("dashboard route serves the requester dashboard page", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(serverUrl(server, "/dashboard"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Contractor Dashboard/);
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

test("demo admin account can log in", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const login = await loginDemoUser(server, "admin@example.com", "admin12345");

  assert.equal(login.user.role, "admin");
  assert.equal(login.user.email, "admin@example.com");
});

test("permit can be created, submitted, and audited by signed-in user", async (t) => {
  requireDb(t);
  const server = await startTestServer();
  t.after(() => server.close());

  const unauthorized = await requestJson(server, "/api/permits");
  assert.equal(unauthorized.response.status, 401);

  const signup = await createSignedInUser(server);
  const authHeaders = {
    authorization: `Bearer ${signup.token}`,
  };

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
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.body.status, "draft");
  assert.equal(createResult.body.requestedBy, signup.user.fullName);
  assert.ok(createResult.body.id);

  const submitResult = await requestJson(
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

  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
  };
  const supervisorHeaders = {
    authorization: `Bearer ${supervisor.token}`,
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

  const submitResult = await requestJson(
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
