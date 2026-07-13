# Permit to Work Management System

Organized source folder for the PTW Guardian web application.

## Folder Map

- `01-backend/` - backend helpers, database schema, static helper, and tests.
- `02-authentication/` - sign in, sign up, and activation pages.
- `03-roles/` - role-specific screens:
  - `organization-admin/`
  - `requester/`
  - `admin/`
  - `safety-officer/`
  - `supervisor/`
  - `worker/`
- `04-shared/` - shared account/support pages, shared CSS, and shared scripts.
- `05-assets/` - image and brand assets.
- `99-local-logs/` - local development logs.

The root `server.js`, `package.json`, and `package-lock.json` stay at the repository root so `npm start` continues to run the app normally.
