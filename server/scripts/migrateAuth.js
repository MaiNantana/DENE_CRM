import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const conn = await mysql.createConnection({
  host:     process.env.DB_HOST     || 'hr.iexcellence.cloud',
  port:     parseInt(process.env.DB_PORT || '3307'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'masterkey',
  database: process.env.DB_NAME     || 'mtcrm',
  multipleStatements: true,
});

await conn.query(`
  CREATE TABLE IF NOT EXISTS staff_accounts (
    id             VARCHAR(36)    NOT NULL DEFAULT (UUID()),
    company_id     TINYINT UNSIGNED NOT NULL DEFAULT 1,
    username       VARCHAR(100)   NOT NULL,
    display_name   VARCHAR(200)   NOT NULL,
    password_hash  VARCHAR(255)   NOT NULL,
    role           ENUM('admin','manager','user') NOT NULL DEFAULT 'user',
    is_active      TINYINT(1)     NOT NULL DEFAULT 1,
    last_login_at  DATETIME       NULL,
    created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_staff_company_username (company_id, username),
    KEY idx_staff_company_role (company_id, role),
    KEY idx_staff_company_active (company_id, is_active)
  ) ENGINE=InnoDB;
`);

console.log('Auth schema migration completed.');
await conn.end();
