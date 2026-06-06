import db from '../db.js';

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const apply = hasFlag('--apply') || hasFlag('--yes');
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [users] = await conn.query('SELECT id, name, total_spent FROM users ORDER BY joined_at ASC, id ASC');
    const [totals] = await conn.query(
      `SELECT user_id, COALESCE(SUM(amount), 0) AS total_spent
       FROM orders
       WHERE status IN ('paid', 'approved')
       GROUP BY user_id`
    );

    const totalMap = new Map(totals.map(row => [row.user_id, Number(row.total_spent) || 0]));
    const changes = [];

    for (const user of users) {
      const expected = totalMap.get(user.id) || 0;
      const current = Number(user.total_spent) || 0;
      if (current === expected) continue;
      changes.push({
        id: user.id,
        name: user.name,
        current,
        expected,
      });
      if (apply) {
        await conn.query('UPDATE users SET total_spent=? WHERE id=?', [expected, user.id]);
      }
    }

    if (apply) {
      await conn.commit();
    } else {
      await conn.rollback();
    }

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      scannedUsers: users.length,
      changedUsers: changes.length,
      changes,
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
