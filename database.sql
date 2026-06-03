CREATE DATABASE IF NOT EXISTS ptw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ptw;

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
