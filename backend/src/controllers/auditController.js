const pool = require('../config/database');

const getLogs = async (req, res) => {
  const { user_id, action, table_name, start_date, end_date, limit = 100, offset = 0 } = req.query;

  const parsedLimit  = Math.min(Math.max(parseInt(limit)  || 100, 1), 500);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);

  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (user_id)    { conditions.push(`al.user_id = $${idx++}`);          params.push(user_id); }
  if (action)     { conditions.push(`al.action ILIKE $${idx++}`);        params.push(`%${action}%`); }
  if (table_name) { conditions.push(`al.table_name = $${idx++}`);        params.push(table_name); }
  if (start_date) { conditions.push(`al.created_at >= $${idx++}`);       params.push(start_date); }
  if (end_date)   { conditions.push(`al.created_at < $${idx++}`);        params.push(end_date + 'T23:59:59'); }

  const where = conditions.join(' AND ');

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs al WHERE ${where}`,
      params
    );

    const dataResult = await pool.query(
      `SELECT al.*, u.username
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parsedLimit, parsedOffset]
    );

    res.json({
      total: parseInt(countResult.rows[0].count),
      limit: parsedLimit,
      offset: parsedOffset,
      logs: dataResult.rows,
    });
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] getLogs error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getFraudAlerts = async (req, res) => {
  const { resolved } = req.query;
  const conditions = ['1=1'];
  const params = [];

  if (resolved !== undefined) {
    conditions.push(`fa.resolved = $1`);
    params.push(resolved === 'true');
  }

  try {
    const result = await pool.query(
      `SELECT fa.*, e.name AS employee_name, u.username AS triggered_by_username
       FROM fraud_alerts fa
       LEFT JOIN employees e ON e.id = fa.employee_id
       LEFT JOIN users u ON u.id = fa.triggered_by_user
       WHERE ${conditions.join(' AND ')}
       ORDER BY fa.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const resolveFraudAlert = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE fraud_alerts
       SET resolved = TRUE, resolved_by = $1, resolved_at = NOW()
       WHERE id = $2 AND resolved = FALSE
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Alert not found or already resolved.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getLogs, getFraudAlerts, resolveFraudAlert };
