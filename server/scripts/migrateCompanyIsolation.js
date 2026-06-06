import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { syncUserTierByPoints } from '../lib/loyalty.js';

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

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await tableExists(tableName))) return;
  if (await columnExists(tableName, columnName)) return;
  await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function dropIndexIfExists(tableName, indexName) {
  if (!(await tableExists(tableName))) return;
  if (!(await indexExists(tableName, indexName))) return;
  await conn.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
}

async function addUniqueIndexIfMissing(tableName, indexName, columns) {
  if (!(await tableExists(tableName))) return;
  if (await indexExists(tableName, indexName)) return;
  const columnSql = columns.map(column => `\`${column}\``).join(', ');
  await conn.query(`ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${indexName}\` (${columnSql})`);
}

async function addIndexIfMissing(tableName, indexName, columns) {
  if (!(await tableExists(tableName))) return;
  if (await indexExists(tableName, indexName)) return;
  const columnSql = columns.map(column => `\`${column}\``).join(', ');
  await conn.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columnSql})`);
}

async function ensureProductsTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS products (
      id           VARCHAR(36)   NOT NULL DEFAULT (UUID()),
      company_id   TINYINT UNSIGNED NOT NULL DEFAULT 1,
      name         VARCHAR(200)  NOT NULL,
      description  TEXT          NULL,
      price        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      category     VARCHAR(120)  NULL,
      is_active    TINYINT(1)    NOT NULL DEFAULT 1,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_products_company_active (company_id, is_active),
      KEY idx_products_company_name (company_id, name)
    ) ENGINE=InnoDB;
  `);
}

async function ensureOrderItemsTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           VARCHAR(36)   NOT NULL DEFAULT (UUID()),
      company_id   TINYINT UNSIGNED NOT NULL DEFAULT 1,
      order_id     VARCHAR(36)   NOT NULL,
      product_id   VARCHAR(36)   NULL,
      name         VARCHAR(300)  NOT NULL,
      unit_price   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      qty          INT           NOT NULL DEFAULT 1,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_order_items_company_order (company_id, order_id),
      KEY idx_order_items_company_product (company_id, product_id)
    ) ENGINE=InnoDB;
  `);
}

async function ensureCompanySettingsTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      company_id       TINYINT UNSIGNED NOT NULL,
      point_expiry_days INT            NOT NULL DEFAULT 365,
      updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id)
    ) ENGINE=InnoDB;
  `);
}

async function backfillCompanyId(tableName) {
  if (!(await tableExists(tableName)) || !(await columnExists(tableName, 'company_id'))) return;
  await conn.query(`UPDATE \`${tableName}\` SET company_id=1 WHERE company_id IS NULL OR company_id=0`);
}

async function resequenceTiers(companyId) {
  if (!(await tableExists('tiers'))) return;
  const [rows] = await conn.query(
    'SELECT id FROM tiers WHERE company_id=? ORDER BY sort_order ASC, min_points ASC, id ASC',
    [companyId]
  );

  let sortOrder = 1;
  for (const row of rows) {
    await conn.query('UPDATE tiers SET sort_order=? WHERE id=? AND company_id=?', [sortOrder, row.id, companyId]);
    sortOrder += 1;
  }
}

const FIXED_POINTS_BENEFIT_RE = /^รับคะแนน\s*x\s*(\d+(?:\.\d+)?)$/i;
const FIXED_DISCOUNT_BENEFIT_RE = /^รับส่วนลด\s*(\d+(?:\.\d+)?)\s*%$/i;

function parseTierBenefits(rawBenefits) {
  if (!rawBenefits) return [];

  let values = [];
  if (Array.isArray(rawBenefits)) {
    values = rawBenefits;
  } else if (typeof rawBenefits === 'string') {
    const trimmed = rawBenefits.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      values = [trimmed];
    }
  } else if (rawBenefits != null) {
    values = [rawBenefits];
  }

  return values
    .map(value => String(value ?? '').trim())
    .filter(Boolean);
}

function sanitizeTierBenefits(rawBenefits) {
  return parseTierBenefits(rawBenefits).filter(
    benefit => !FIXED_POINTS_BENEFIT_RE.test(benefit) && !FIXED_DISCOUNT_BENEFIT_RE.test(benefit)
  );
}

function extractDiscountPercent(rawBenefits) {
  for (const benefit of parseTierBenefits(rawBenefits)) {
    const match = benefit.match(FIXED_DISCOUNT_BENEFIT_RE);
    if (match) return Math.max(Number(match[1]) || 0, 0);
  }
  return 0;
}

async function cloneTiersForCompany(targetCompanyId) {
  if (!(await tableExists('tiers'))) return;
  const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM tiers WHERE company_id=?', [targetCompanyId]);
  if (Number(count) > 0) return;

  const [sourceRows] = await conn.query(
    'SELECT name, min_points, multiplier, baht_per_point, discount_percent, duration_days, color, benefits, sort_order FROM tiers WHERE company_id=1 ORDER BY sort_order ASC, min_points ASC, id ASC'
  );

  for (const row of sourceRows) {
    await conn.query(
      'INSERT INTO tiers (id, company_id, name, min_points, multiplier, baht_per_point, discount_percent, duration_days, color, benefits, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        targetCompanyId,
        row.name,
        row.min_points,
        row.multiplier,
        row.baht_per_point,
        row.discount_percent ?? extractDiscountPercent(row.benefits),
        row.duration_days,
        row.color,
        JSON.stringify(sanitizeTierBenefits(row.benefits)),
        row.sort_order,
      ]
    );
  }
}

async function clonePromotionsForCompany(targetCompanyId) {
  if (!(await tableExists('promotions'))) return;
  const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM promotions WHERE company_id=?', [targetCompanyId]);
  if (Number(count) > 0) return;

  const [sourceRows] = await conn.query(
    'SELECT title, description, points_required, status, redeem_mode, expires_at FROM promotions WHERE company_id=1 ORDER BY created_at ASC, id ASC'
  );

  for (const row of sourceRows) {
    await conn.query(
      'INSERT INTO promotions (id, company_id, title, description, points_required, status, redeem_mode, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), targetCompanyId, row.title, row.description, row.points_required, row.status, row.redeem_mode, row.expires_at]
    );
  }
}

console.log('Applying company isolation migration...');

await ensureProductsTable();
await ensureOrderItemsTable();
await ensureCompanySettingsTable();

const tablesWithCompanyId = [
  'tiers',
  'staff_accounts',
  'users',
  'products',
  'promotions',
  'orders',
  'order_items',
  'point_transactions',
  'redemptions',
  'promotion_redemption_requests',
  'chat_messages',
];

for (const tableName of tablesWithCompanyId) {
  await addColumnIfMissing(tableName, 'company_id', 'TINYINT UNSIGNED NOT NULL DEFAULT 1');
  await backfillCompanyId(tableName);
}

await addColumnIfMissing('tiers', 'sort_order', 'INT NOT NULL DEFAULT 0');
await addColumnIfMissing('tiers', 'baht_per_point', 'DECIMAL(12,2) NOT NULL DEFAULT 10.00');
await addColumnIfMissing('tiers', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00');
await addColumnIfMissing('tiers', 'duration_days', 'INT NOT NULL DEFAULT 365');
await addColumnIfMissing('users', 'tier_expires_at', 'DATETIME NULL');
await addColumnIfMissing('products', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
await addColumnIfMissing('products', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
await addColumnIfMissing('products', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
await addColumnIfMissing('orders', 'discount_mode', "ENUM('manual','member') NOT NULL DEFAULT 'manual'");
await addColumnIfMissing('order_items', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
await addColumnIfMissing('point_transactions', 'points_remaining', 'INT NOT NULL DEFAULT 0');
await addColumnIfMissing('point_transactions', 'expires_at', 'DATETIME NULL');

await dropIndexIfExists('tiers', 'uq_tier_name');
await dropIndexIfExists('staff_accounts', 'uq_staff_username');
await dropIndexIfExists('users', 'uq_line_id');
await dropIndexIfExists('orders', 'uq_order_ref');

await addUniqueIndexIfMissing('tiers', 'uq_tier_company_name', ['company_id', 'name']);
await addUniqueIndexIfMissing('staff_accounts', 'uq_staff_company_username', ['company_id', 'username']);
await addUniqueIndexIfMissing('users', 'uq_user_company_line_id', ['company_id', 'line_id']);
await addUniqueIndexIfMissing('orders', 'uq_order_company_ref', ['company_id', 'order_ref']);

await addIndexIfMissing('tiers', 'idx_tier_company_sort', ['company_id', 'sort_order']);
await addIndexIfMissing('tiers', 'idx_tier_company_points', ['company_id', 'min_points']);
await addIndexIfMissing('staff_accounts', 'idx_staff_company_role', ['company_id', 'role']);
await addIndexIfMissing('staff_accounts', 'idx_staff_company_active', ['company_id', 'is_active']);
await addIndexIfMissing('users', 'idx_user_company_tier', ['company_id', 'tier']);
await addIndexIfMissing('users', 'idx_user_company_points', ['company_id', 'points']);
await addIndexIfMissing('products', 'idx_products_company_active', ['company_id', 'is_active']);
await addIndexIfMissing('products', 'idx_products_company_name', ['company_id', 'name']);
await addIndexIfMissing('promotions', 'idx_promotions_company_status', ['company_id', 'status']);
await addIndexIfMissing('orders', 'idx_order_company_user', ['company_id', 'user_id']);
await addIndexIfMissing('orders', 'idx_order_company_status', ['company_id', 'status']);
await addIndexIfMissing('orders', 'idx_order_company_ordered_at', ['company_id', 'ordered_at']);
await addIndexIfMissing('order_items', 'idx_order_items_company_order', ['company_id', 'order_id']);
await addIndexIfMissing('order_items', 'idx_order_items_company_product', ['company_id', 'product_id']);
await addIndexIfMissing('point_transactions', 'idx_pt_company_user', ['company_id', 'user_id']);
await addIndexIfMissing('point_transactions', 'idx_pt_company_type', ['company_id', 'type']);
await addIndexIfMissing('point_transactions', 'idx_pt_company_expiry', ['company_id', 'user_id', 'expires_at']);
await addIndexIfMissing('redemptions', 'idx_red_company_user', ['company_id', 'user_id']);
await addIndexIfMissing('redemptions', 'idx_red_company_promotion', ['company_id', 'promotion_id']);
await addIndexIfMissing('promotion_redemption_requests', 'idx_req_company_user', ['company_id', 'user_id']);
await addIndexIfMissing('promotion_redemption_requests', 'idx_req_company_promotion', ['company_id', 'promotion_id']);
await addIndexIfMissing('promotion_redemption_requests', 'idx_req_company_status', ['company_id', 'status']);
await addIndexIfMissing('promotion_redemption_requests', 'idx_req_company_requested_at', ['company_id', 'requested_at']);
await addIndexIfMissing('promotion_redemption_requests', 'idx_req_company_user_status', ['company_id', 'user_id', 'status']);
await addIndexIfMissing('chat_messages', 'idx_chat_company_user', ['company_id', 'user_id']);

await resequenceTiers(1);
await resequenceTiers(2);

if (await tableExists('tiers')) {
  const [tierRows] = await conn.query('SELECT id, company_id, benefits, discount_percent FROM tiers ORDER BY company_id ASC, sort_order ASC, min_points ASC, id ASC');
  for (const row of tierRows) {
    const normalizedBenefits = sanitizeTierBenefits(row.benefits);
    const derivedDiscount = row.discount_percent && Number(row.discount_percent) > 0
      ? Number(row.discount_percent)
      : extractDiscountPercent(row.benefits);

    await conn.query(
      'UPDATE tiers SET benefits=?, discount_percent=? WHERE id=? AND company_id=?',
      [JSON.stringify(normalizedBenefits), derivedDiscount, row.id, row.company_id]
    );
  }
}
await cloneTiersForCompany(2);
await clonePromotionsForCompany(2);
await resequenceTiers(1);
await resequenceTiers(2);

await conn.query(
  'INSERT IGNORE INTO company_settings (company_id, point_expiry_days) VALUES (1, 365), (2, 365)'
);

if (await tableExists('users')) {
  const [userRows] = await conn.query('SELECT id, company_id FROM users ORDER BY company_id ASC, joined_at ASC, id ASC');
  for (const row of userRows) {
    await syncUserTierByPoints(conn, row.id, row.company_id);
  }
}

console.log('Company isolation migration completed.');
await conn.end();
