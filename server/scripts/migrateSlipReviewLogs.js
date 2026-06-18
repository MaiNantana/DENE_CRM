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

async function hasTable(tableName) {
  const [[row]] = await conn.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
    `,
    [dbName, tableName]
  );
  return Number(row.count) > 0;
}

async function hasColumn(tableName, columnName) {
  const [[row]] = await conn.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [dbName, tableName, columnName]
  );
  return Number(row.count) > 0;
}

async function hasIndex(tableName, indexName) {
  const [[row]] = await conn.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [dbName, tableName, indexName]
  );
  return Number(row.count) > 0;
}

async function addColumnIfMissing(tableName, columnName, definition, afterColumn) {
  if (!(await hasTable(tableName))) return;
  if (await hasColumn(tableName, columnName)) return;
  const afterClause = afterColumn ? ` AFTER ${afterColumn}` : '';
  await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}${afterClause}`);
}

async function addIndexIfMissing(tableName, indexName, columns, unique = false) {
  if (!(await hasTable(tableName))) return;
  if (await hasIndex(tableName, indexName)) return;
  const columnSql = columns.map(column => `\`${column}\``).join(', ');
  const uniqueSql = unique ? 'UNIQUE KEY' : 'INDEX';
  await conn.query(`ALTER TABLE \`${tableName}\` ADD ${uniqueSql} \`${indexName}\` (${columnSql})`);
}

console.log('Ensuring slip review logs schema...');

await conn.query(`
  CREATE TABLE IF NOT EXISTS slip_review_logs (
    id                  VARCHAR(36)    NOT NULL DEFAULT (UUID()),
    company_id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
    analysis_id         VARCHAR(64)    NOT NULL,
    user_id             VARCHAR(36)    NULL,
    line_id             VARCHAR(100)   NULL,
    source              ENUM('analyze','order') NOT NULL DEFAULT 'analyze',
    status              ENUM('verified','uncertain','suspicious','duplicate','manual') NOT NULL DEFAULT 'manual',
    amount              DECIMAL(12,2)  NULL,
    bank                VARCHAR(100)   NULL,
    reference_number    VARCHAR(120)   NULL,
    slip_fingerprint    VARCHAR(64)    NULL,
    slip_transaction_date DATE         NULL,
    slip_transaction_time VARCHAR(20)  NULL,
    duplicate_order_id  VARCHAR(36)    NULL,
    duplicate_order_ref VARCHAR(50)    NULL,
    reason              VARCHAR(300)   NULL,
    created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slip_review_company_analysis (company_id, analysis_id),
    KEY idx_slip_review_company_status (company_id, status, created_at),
    KEY idx_slip_review_company_user (company_id, user_id, created_at),
    KEY idx_slip_review_company_fingerprint (company_id, slip_fingerprint),
    KEY idx_slip_review_company_reference (company_id, reference_number)
  ) ENGINE=InnoDB;
`);

await addColumnIfMissing('slip_review_logs', 'slip_transaction_date', 'DATE NULL', 'slip_fingerprint');
await addColumnIfMissing('slip_review_logs', 'slip_transaction_time', 'VARCHAR(20) NULL', 'slip_transaction_date');
await addColumnIfMissing('slip_review_logs', 'duplicate_order_id', 'VARCHAR(36) NULL', 'slip_transaction_time');
await addColumnIfMissing('slip_review_logs', 'duplicate_order_ref', 'VARCHAR(50) NULL', 'duplicate_order_id');
await addColumnIfMissing('slip_review_logs', 'reason', 'VARCHAR(300) NULL', 'duplicate_order_ref');

await addIndexIfMissing('slip_review_logs', 'uq_slip_review_company_analysis', ['company_id', 'analysis_id'], true);
await addIndexIfMissing('slip_review_logs', 'idx_slip_review_company_status', ['company_id', 'status', 'created_at']);
await addIndexIfMissing('slip_review_logs', 'idx_slip_review_company_user', ['company_id', 'user_id', 'created_at']);
await addIndexIfMissing('slip_review_logs', 'idx_slip_review_company_fingerprint', ['company_id', 'slip_fingerprint']);
await addIndexIfMissing('slip_review_logs', 'idx_slip_review_company_reference', ['company_id', 'reference_number']);

if (await hasTable('orders') && await hasColumn('orders', 'slip_verification_status')) {
  await conn.query(`
    INSERT INTO slip_review_logs (
      id, company_id, analysis_id, user_id, line_id, source, status, amount, bank,
      reference_number, slip_fingerprint, slip_transaction_date, slip_transaction_time,
      duplicate_order_id, duplicate_order_ref, reason, created_at
    )
    SELECT
      CONCAT('backfill-', o.id),
      o.company_id,
      CONCAT('order-', o.order_ref),
      o.user_id,
      u.line_id,
      'order',
      o.slip_verification_status,
      o.amount,
      o.slip_bank,
      o.slip_reference_number,
      o.slip_fingerprint,
      o.slip_transaction_date,
      o.slip_transaction_time,
      NULL,
      o.order_ref,
      'Backfilled from existing order records',
      o.ordered_at
    FROM orders o
    LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
    WHERE o.slip_verification_status IN ('suspicious', 'duplicate')
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      amount = VALUES(amount),
      bank = VALUES(bank),
      reference_number = VALUES(reference_number),
      slip_fingerprint = VALUES(slip_fingerprint),
      slip_transaction_date = VALUES(slip_transaction_date),
      slip_transaction_time = VALUES(slip_transaction_time),
      duplicate_order_ref = VALUES(duplicate_order_ref),
      reason = VALUES(reason)
  `);
}

console.log('Slip review logs migration completed.');
await conn.end();
