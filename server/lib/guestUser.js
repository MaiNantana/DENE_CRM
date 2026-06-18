import crypto from 'crypto';

const GUEST_NAME_FALLBACK = 'ลูกค้าทั่วไป';

function guestCustomerCode(companyId) {
  const prefix = Number(companyId) === 2 ? 'KEFERA' : 'DENE';
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.toUpperCase();
  return `${prefix}-G${suffix}`;
}

/**
 * Resolve the users row for a non-member (walk-in) by their LINE id, creating a record
 * marked `is_member = 0` if none exists. Members keep their existing row untouched.
 * Returns the users row. Must run inside the caller's transaction connection.
 */
export async function getOrCreateGuestUser(conn, companyId, lineId, name) {
  const trimmedLineId = String(lineId || '').trim();
  if (!trimmedLineId) throw new Error('lineId is required for a guest order');

  const [[existing]] = await conn.query(
    'SELECT * FROM users WHERE company_id=? AND line_id=? LIMIT 1',
    [companyId, trimmedLineId]
  );
  if (existing) return existing;

  const guestName = String(name || '').trim() || GUEST_NAME_FALLBACK;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const customerCode = guestCustomerCode(companyId);
    try {
      await conn.query(
        'INSERT INTO users (company_id, customer_code, line_id, name, is_member) VALUES (?, ?, ?, ?, 0)',
        [companyId, customerCode, trimmedLineId, guestName]
      );
      break;
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY' && /customer_code/i.test(String(err?.sqlMessage || ''))) {
        continue;
      }
      throw err;
    }
  }

  const [[user]] = await conn.query(
    'SELECT * FROM users WHERE company_id=? AND line_id=? LIMIT 1',
    [companyId, trimmedLineId]
  );
  return user;
}
