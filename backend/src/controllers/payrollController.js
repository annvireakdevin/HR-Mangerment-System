const payrollService = require('../services/payrollService');
const pool = require('../config/database');
const audit = require('../services/auditService');

const getSummary = async (req, res) => {
  const { start_date, end_date, employee_id, position_id } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required.' });
  }
  if (start_date > end_date) {
    return res.status(400).json({ error: 'start_date must be before end_date.' });
  }

  // Employees can only view their own payroll
  let effectiveEmployeeId = employee_id;
  if (req.user.role === 'employee' && req.user.employee_id) {
    effectiveEmployeeId = req.user.employee_id;
  }

  try {
    const rows = await payrollService.calculate({
      startDate: start_date,
      endDate: end_date,
      employeeId: effectiveEmployeeId,
      positionId: position_id,
    });

    const summary = {
      start_date,
      end_date,
      total_employees: rows.length,
      grand_total_hours: rows.reduce((s, r) => s + r.total_hours, 0),
      grand_total_ot_hours: rows.reduce((s, r) => s + r.total_ot_hours, 0),
      grand_total_salary: parseFloat(
        rows.reduce((s, r) => s + r.total_salary, 0).toFixed(2)
      ),
      records: rows,
    };

    res.json(summary);
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] payroll error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Payroll Lock management
const getLocks = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pl.*, u1.username AS locked_by_username, u2.username AS unlocked_by_username
       FROM payroll_locks pl
       LEFT JOIN users u1 ON u1.id = pl.locked_by
       LEFT JOIN users u2 ON u2.id = pl.unlocked_by
       ORDER BY pl.start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createLock = async (req, res) => {
  const { period_label, start_date, end_date } = req.body;
  if (!period_label || !start_date || !end_date) {
    return res.status(400).json({ error: 'period_label, start_date, and end_date are required.' });
  }
  if (start_date > end_date) {
    return res.status(400).json({ error: 'start_date must be before or equal to end_date.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payroll_locks (period_label, start_date, end_date, locked_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [period_label, start_date, end_date, req.user.id]
    );
    const lock = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'LOCK_PAYROLL',
      tableName: 'payroll_locks',
      recordId: lock.id,
      newValue: lock,
      ipAddress: req.ip,
    });

    res.status(201).json(lock);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const toggleLock = async (req, res) => {
  try {
    const current = await pool.query('SELECT * FROM payroll_locks WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Lock not found.' });

    const nowLocked = !current.rows[0].is_locked;
    const result = await pool.query(
      `UPDATE payroll_locks
       SET is_locked = $1,
           unlocked_by = CASE WHEN $1 = FALSE THEN $2 ELSE NULL END,
           unlocked_at = CASE WHEN $1 = FALSE THEN NOW() ELSE NULL END
       WHERE id = $3 RETURNING *`,
      [nowLocked, req.user.id, req.params.id]
    );

    await audit.log({
      userId: req.user.id,
      action: nowLocked ? 'LOCK_PAYROLL' : 'UNLOCK_PAYROLL',
      tableName: 'payroll_locks',
      recordId: current.rows[0].id,
      oldValue: { is_locked: current.rows[0].is_locked },
      newValue: { is_locked: nowLocked },
      ipAddress: req.ip,
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getSummary, getLocks, createLock, toggleLock };
