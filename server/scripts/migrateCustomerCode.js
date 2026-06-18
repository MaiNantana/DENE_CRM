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

async function tableExists(tableName) {
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

async function columnExists(tableName, columnName) {
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

async function indexExists(tableName, indexName) {
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

function getCompanyPrefix(companyId) {
  return companyId === 2 ? 'KEFERA' : 'DENE';
}

function parseCodeSeq(code) {
  const match = String(code || '').trim().match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) || 0 : 0;
}

async function ensureCustomerCodeColumn() {
  if (!(await tableExists('users'))) return false;
  if (!(await columnExists('users', 'customer_code'))) {
    await conn.query('ALTER TABLE users ADD COLUMN customer_code VARCHAR(30) NULL AFTER company_id');
  }
  return true;
}

async function backfillCustomerCodes() {
  const [companies] = await conn.query('SELECT DISTINCT company_id FROM users ORDER BY company_id ASC');
  for (const company of companies) {
    const companyId = Number(company.company_id) || 1;
    const prefix = getCompanyPrefix(companyId);
    const [existing] = await conn.query(
      'SELECT customer_code FROM users WHERE company_id=? AND customer_code IS NOT NULL AND customer_code <> "" ORDER BY customer_code DESC LIMIT 1',
      [companyId]
    );
    let nextSeq = parseCodeSeq(existing[0]?.customer_code) + 1;

    const [rows] = await conn.query(
      'SELECT id FROM users WHERE company_id=? AND (customer_code IS NULL OR customer_code = "") ORDER BY joined_at ASC, id ASC',
      [companyId]
    );

    for (const row of rows) {
      const customerCode = `${prefix}-${String(nextSeq).padStart(6, '0')}`;
      nextSeq += 1;
      await conn.query('UPDATE users SET customer_code=? WHERE id=? AND company_id=?', [customerCode, row.id, companyId]);
    }
  }
}

async function run() {
  if (!(await ensureCustomerCodeColumn())) {
    console.log('users table not found, skip');
    return;
  }

  await backfillCustomerCodes();

  if (await columnExists('users', 'customer_code')) {
    await conn.query('ALTER TABLE users MODIFY customer_code VARCHAR(30) NOT NULL');
  }

  if (!(await indexExists('users', 'uq_user_company_customer_code'))) {
    await conn.query('ALTER TABLE users ADD UNIQUE KEY uq_user_company_customer_code (company_id, customer_code)');
  }

  console.log('Customer code migration completed');
}

try {
  await run();
} finally {
  await conn.end();
}
