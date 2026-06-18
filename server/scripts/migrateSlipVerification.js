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
  if (await hasColumn(tableName, columnName)) return;
  const afterClause = afterColumn ? ` AFTER ${afterColumn}` : '';
  await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}${afterClause}`);
}

async function addIndexIfMissing(tableName, indexName, columns) {
  if (await hasIndex(tableName, indexName)) return;
  const columnSql = columns.map(column => `\`${column}\``).join(', ');
  await conn.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columnSql})`);
}

console.log('Ensuring slip verification schema...');

await addColumnIfMissing('orders', 'slip_fingerprint', 'VARCHAR(64) NULL', 'slip_url');
await addColumnIfMissing('orders', 'slip_reference_number', 'VARCHAR(120) NULL', 'slip_fingerprint');
await addColumnIfMissing('orders', 'slip_bank', 'VARCHAR(100) NULL', 'slip_reference_number');
await addColumnIfMissing('orders', 'slip_transaction_date', 'DATE NULL', 'slip_bank');
await addColumnIfMissing('orders', 'slip_transaction_time', 'VARCHAR(20) NULL', 'slip_transaction_date');
await addColumnIfMissing(
  'orders',
  'slip_verification_status',
  "ENUM('manual','verified','uncertain','suspicious','duplicate') NOT NULL DEFAULT 'manual'",
  'slip_transaction_time'
);

await addIndexIfMissing('orders', 'idx_order_company_slip_fingerprint', ['company_id', 'slip_fingerprint']);
await addIndexIfMissing('orders', 'idx_order_company_slip_reference', ['company_id', 'slip_reference_number']);

await conn.query(`
  UPDATE orders
  SET slip_verification_status = COALESCE(slip_verification_status, 'manual')
`);

console.log('Slip verification migration completed.');
await conn.end();
