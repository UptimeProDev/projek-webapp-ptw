CREATE DATABASE IF NOT EXISTS ptw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ptw;

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  registration_no VARCHAR(120) NOT NULL UNIQUE,
  admin_user_id CHAR(36),
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  UNIQUE INDEX idx_organizations_registration_no (registration_no),
  INDEX idx_organizations_admin_user_id (admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  organization VARCHAR(255) NOT NULL,
  organization_id CHAR(36),
  company_registration_no VARCHAR(120),
  role VARCHAR(50) NOT NULL,
  roles LONGTEXT,
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
  INDEX idx_users_organization_id (organization_id),
  INDEX idx_users_organization_role (organization_id, role),
  INDEX idx_users_token (token),
  INDEX idx_users_email (email),
  INDEX idx_users_activation_token (activation_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permits (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
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
  documents LONGTEXT,
  assigned_workers LONGTEXT,
  site_validation LONGTEXT,
  rejection_snapshot_hash VARCHAR(80),
  status VARCHAR(40) NOT NULL,
  work_state VARCHAR(40) NOT NULL DEFAULT 'not_started',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_permits_organization_id (organization_id),
  INDEX idx_permits_requested_by_id (requested_by_id),
  INDEX idx_permits_status (status),
  CONSTRAINT fk_permits_requested_by
    FOREIGN KEY (requested_by_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workers (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
  ic_passport VARCHAR(80),
  employee_id VARCHAR(32) UNIQUE,
  name VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(120),
  permits LONGTEXT,
  expiry VARCHAR(40),
  certifications LONGTEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  company VARCHAR(255),
  trade VARCHAR(120),
  organization VARCHAR(255),
  permit_types LONGTEXT,
  competencies LONGTEXT,
  license_expiry VARCHAR(40),
  status VARCHAR(40) DEFAULT 'valid',
  created_by CHAR(36),
  review_comment TEXT,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  UNIQUE INDEX idx_workers_ic_passport (ic_passport),
  INDEX idx_workers_organization_id (organization_id),
  INDEX idx_workers_created_by (created_by),
  INDEX idx_workers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
  permit_id CHAR(36) NOT NULL,
  occurred_at VARCHAR(40) NOT NULL,
  actor_user_id CHAR(36),
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50),
  action VARCHAR(80) NOT NULL,
  from_status VARCHAR(40),
  to_status VARCHAR(40),
  comment TEXT,
  INDEX idx_audit_logs_organization_id (organization_id),
  INDEX idx_audit_logs_permit_id (permit_id),
  CONSTRAINT fk_audit_logs_permit
    FOREIGN KEY (permit_id) REFERENCES permits(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_audit_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS extension_requests (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
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
  INDEX idx_extension_requests_organization_id (organization_id),
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

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
  user_id CHAR(36) NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(255),
  entity_type VARCHAR(80),
  entity_id CHAR(36),
  read_at VARCHAR(40),
  created_at VARCHAR(40) NOT NULL,
  INDEX idx_notifications_organization_id (organization_id),
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_user_read (user_id, read_at),
  INDEX idx_notifications_entity (entity_type, entity_id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
