import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbName = process.env.DB_NAME || 'mtcrm';
const conn = await mysql.createConnection({
  host:     process.env.DB_HOST     || 'hr.iexcellence.cloud',
  port:     parseInt(process.env.DB_PORT || '3307'),
  user:     process.env.DB_USER     || 'root',
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

async function addColumnIfMissing(tableName, columnName, definition, afterColumn) {
  if (await hasColumn(tableName, columnName)) return;
  const afterClause = afterColumn ? ` AFTER ${afterColumn}` : '';
  await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}${afterClause}`);
}

console.log('Ensuring order discount schema...');

await addColumnIfMissing('orders', 'discount', 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'amount');

await conn.query(`
  UPDATE orders
  SET discount = 0
  WHERE discount IS NULL
`);

console.log('Order discount migration completed.');
await conn.end();
