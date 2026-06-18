import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbName = process.env.DB_NAME || 'mtcrm';
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'hr.iexcellence.cloud',
  port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'masterkey',
  database: dbName,
  multipleStatements: true,
});

console.log('Ensuring payment_accounts table...');

await conn.query(`
  CREATE TABLE IF NOT EXISTS payment_accounts (
    id             VARCHAR(36)   NOT NULL DEFAULT (UUID()),
    company_id     TINYINT UNSIGNED NOT NULL DEFAULT 1,
    bank           VARCHAR(100)  NOT NULL,
    account_name   VARCHAR(200)  NOT NULL,
    account_number VARCHAR(50)   NULL,
    promptpay      VARCHAR(50)   NULL,
    note           VARCHAR(255)  NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order     INT           NOT NULL DEFAULT 0,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payment_company_active (company_id, is_active)
  ) ENGINE=InnoDB
`);

console.log('payment_accounts migration completed.');
await conn.end();
