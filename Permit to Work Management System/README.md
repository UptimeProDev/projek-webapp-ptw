# Permit to Work Management System

Organized source folder for the PTW Guardian web application.

## Folder Map

- `01-backend/` - backend helpers, database schema, static helper, and tests.
- `02-authentication/` - sign in, sign up, and activation pages.
- `03-roles/` - role-specific screens:
  - `organization-admin/`
  - `superadmin/` - platform owner control center for multi-company tenant governance
  - `requester/`
  - `admin/`
  - `safety-officer/`
  - `supervisor/`
  - `worker/`
- `04-shared/` - shared account/support pages, shared CSS, and shared scripts.
- `05-assets/` - image and brand assets.
- `99-local-logs/` - local development logs.

The root `server.js`, `package.json`, and `package-lock.json` stay at the repository root so `npm start` continues to run the app normally.

## Organization Data Model

The XAMPP/MySQL database uses one shared database named `ptw`, with `organizations.id` as the workspace key. Company-specific records in `users`, `permits`, `workers`, `audit_logs`, `extension_requests`, and `notifications` carry `organization_id`, so Company A and Company B records stay separated by queries and indexes.

Uploaded profile pictures, worker certifications, and permit documents are stored under organization-specific subfolders in `uploads/` for new uploads.
