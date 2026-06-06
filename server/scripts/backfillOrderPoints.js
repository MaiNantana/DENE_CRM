import db from '../db.js';
import { syncUserTierByPoints } from '../lib/loyalty.js';

const VALID_PAID_STATUSES = new Set(['paid', 'approved']);

function normalizeStatus(status) {
  return status === 'approved' ? 'paid' : status;
}

function calculatePoints(amount, bahtPerPoint = 10, multiplier = 1) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount <= 0) return 0;
  const rate = Number(bahtPerPoint) || 10;
  const mult = Number(multiplier) || 1;
  return Math.floor((numericAmount / rate) * mult);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const apply = hasFlag('--apply') || hasFlag('--yes');
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      `SELECT o.id, o.order_ref, o.company_id, o.user_id, o.amount, o.points_earned, o.status,
              o.ordered_at AS orderedAt,
              u.name AS user_name, u.tier AS user_tier,
              COALESCE(t.baht_per_point, 10) AS baht_per_point,
              COALESCE(t.multiplier, 1) AS multiplier,
              COALESCE(cs.point_expiry_days, 0) AS point_expiry_days
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id AND u.company_id = o.company_id
       LEFT JOIN tiers t ON t.name = u.tier AND t.company_id = o.company_id
       LEFT JOIN company_settings cs ON cs.company_id = o.company_id
       WHERE o.status IN ('paid', 'approved')
       ORDER BY o.ordered_at ASC, o.id ASC`
    );

    const summary = {
      scanned: orders.length,
      updatedOrders: 0,
      insertedTransactions: 0,
      adjustedUsers: 0,
      skippedExistingTransactions: 0,
    };

    for (const order of orders) {
      const status = normalizeStatus(order.status);
      const expectedPoints = calculatePoints(order.amount, order.baht_per_point, order.multiplier);
      const recordedPoints = Number(order.points_earned) || 0;
      const [existingTx] = await conn.query(
        `SELECT id
         FROM point_transactions
         WHERE type='earn' AND ref_id=?
         LIMIT 1`,
        [String(order.id)]
      );
      const hasEarnTransaction = existingTx.length > 0;

      if (recordedPoints !== expectedPoints) {
        summary.updatedOrders += 1;
        if (apply) {
          await conn.query('UPDATE orders SET points_earned=? WHERE id=?', [expectedPoints, order.id]);
        }
      }

      if (status !== 'paid' || expectedPoints <= 0) {
        continue;
      }

      if (hasEarnTransaction) {
        summary.skippedExistingTransactions += 1;
        continue;
      }

      summary.insertedTransactions += 1;
      summary.adjustedUsers += 1;
      if (apply) {
        await conn.query('UPDATE users SET points = points + ? WHERE id=? AND company_id=?', [
          expectedPoints,
          order.user_id,
          order.company_id,
        ]);
        await syncUserTierByPoints(conn, order.user_id, order.company_id);
        await conn.query(
          'INSERT INTO point_transactions (company_id, user_id, type, points, points_remaining, ref_id, note, expires_at) VALUES (?,?,?,?,?,?,?, IF(? > 0, DATE_ADD(?, INTERVAL ? DAY), NULL))',
          [
            order.company_id,
            order.user_id,
            'earn',
            expectedPoints,
            0,
            String(order.id),
            `Backfill ออเดอร์ ${order.order_ref}`,
            Number(order.point_expiry_days) || 0,
            order.orderedAt,
            Number(order.point_expiry_days) || 0,
          ]
        );
      }
    }

    if (apply) {
      await conn.commit();
    } else {
      await conn.rollback();
    }

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      ...summary,
    }, null, 2));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await db.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
