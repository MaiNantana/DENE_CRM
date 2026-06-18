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

async function hasColumn(tableName, columnName) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName]
  );
  return Number(row.count) > 0;
}

async function hasIndex(tableName, indexName) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, tableName, indexName]
  );
  return Number(row.count) > 0;
}

console.log('Ensuring membership flag schema...');

if (!(await hasColumn('users', 'is_member'))) {
  // Existing rows are real members -> default 1. New guest (walk-in) rows are inserted with 0.
  await conn.query("ALTER TABLE `users` ADD COLUMN `is_member` TINYINT(1) NOT NULL DEFAULT 1 AFTER `tier_expires_at`");
}

if (!(await hasIndex('users', 'idx_user_company_member'))) {
  await conn.query('ALTER TABLE `users` ADD INDEX `idx_user_company_member` (`company_id`, `is_member`)');
}

console.log('Membership flag migration completed.');
await conn.end();
