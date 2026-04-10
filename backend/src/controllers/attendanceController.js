const pool = require('../config/database');
const audit = require('../services/auditService');
const fraud = require('../services/fraudService');

// Helper: check if a date range is locked
const isDateLocked = async (date) => {
  const result = await pool.query(
    `SELECT id FROM payroll_locks
     WHERE is_locked = TRUE AND $1 BETWEEN start_date AND end_date
     LIMIT 1`,
    [date]
  );
  return result.rows.length > 0;
};

const getAll = async (req, res) => {
  const { start_date, end_date, employee_id } = req.query;

  let query = `
    SELECT a.*, e.name AS employee_name, u.username AS created_by_username
    FROM attendance a
    JOIN employees e ON e.id = a.employee_id
    LEFT JOIN users u ON u.id = a.created_by
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (start_date) { query += ` AND a.date >= $${idx++}`; params.push(start_date); }
  if (end_date)   { query += ` AND a.date <= $${idx++}`; params.push(end_date); }
  if (employee_id){ query += ` AND a.employee_id = $${idx++}`; params.push(employee_id); }

  // Employees can only see their own attendance
  if (req.user.role === 'employee' && req.user.employee_id) {
    query += ` AND a.employee_id = $${idx++}`;
    params.push(req.user.employee_id);
  }

  query += ' ORDER BY a.date DESC, e.name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] attendance error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const VALID_STATUSES = new Set(['present', 'absent']);

const create = async (req, res) => {
  const { employee_id, date, hours_worked, ot_hours, status } = req.body;

  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id and date are required.' });
  }

  // Cannot input future date
  const today = new Date().toISOString().split('T')[0];
  if (date > today) {
    return res.status(400).json({ error: 'Cannot input attendance for a future date.' });
  }

  const hw = hours_worked !== undefined ? parseFloat(hours_worked) : 0;
  const ot = ot_hours     !== undefined ? parseFloat(ot_hours)     : 0;

  if (!isFinite(hw) || hw < 0) {
    return res.status(400).json({ error: 'hours_worked must be a non-negative number.' });
  }
  if (!isFinite(ot) || ot < 0) {
    return res.status(400).json({ error: 'ot_hours must be a non-negative number.' });
  }
  if (hw > 24) {
    return res.status(400).json({ error: 'hours_worked cannot exceed 24.' });
  }
  if (ot > 16) {
    return res.status(400).json({ error: 'ot_hours cannot exceed 16.' });
  }
  if (status !== undefined && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be "present" or "absent".' });
  }

  // Check payroll lock
  if (await isDateLocked(date)) {
    return res.status(409).json({ error: 'This period is locked. Contact admin to unlock.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO attendance (employee_id, date, hours_worked, ot_hours, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee_id, date, hw, ot, status || 'present', req.user.id]
    );
    const record = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'CREATE_ATTENDANCE',
      tableName: 'attendance',
      recordId: record.id,
      newValue: record,
      ipAddress: req.ip,
    });

    // Fraud checks
    await fraud.checkOtThreshold(record, req.user.id);
    await fraud.checkHrEditVolume(req.user.id);

    res.status(201).json(record);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Attendance record already exists for this employee on this date.' });
    }
    process.stderr.write(`[${new Date().toISOString()}] attendance error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const update = async (req, res) => {
  const { hours_worked, ot_hours, status } = req.body;

  try {
    const old = await pool.query('SELECT * FROM attendance WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Attendance record not found.' });

    const record = old.rows[0];

    // Check if approved - cannot edit approved records unless admin
    if (record.approved && req.user.role !== 'admin') {
      return res.status(409).json({ error: 'Cannot edit an approved attendance record.' });
    }

    // Check payroll lock
    if (await isDateLocked(record.date)) {
      return res.status(409).json({ error: 'This period is locked. Contact admin to unlock.' });
    }

    if (hours_worked !== undefined) {
      const hw = parseFloat(hours_worked);
      if (!isFinite(hw) || hw < 0) return res.status(400).json({ error: 'hours_worked must be a non-negative number.' });
      if (hw > 24) return res.status(400).json({ error: 'hours_worked cannot exceed 24.' });
    }
    if (ot_hours !== undefined) {
      const ot = parseFloat(ot_hours);
      if (!isFinite(ot) || ot < 0) return res.status(400).json({ error: 'ot_hours must be a non-negative number.' });
      if (ot > 16) return res.status(400).json({ error: 'ot_hours cannot exceed 16.' });
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'status must be "present" or "absent".' });
    }

    const result = await pool.query(
      `UPDATE attendance
       SET hours_worked = COALESCE($1, hours_worked),
           ot_hours = COALESCE($2, ot_hours),
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [hours_worked, ot_hours, status, req.params.id]
    );
    const updated = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'UPDATE_ATTENDANCE',
      tableName: 'attendance',
      recordId: updated.id,
      oldValue: old.rows[0],
      newValue: updated,
      ipAddress: req.ip,
    });

    await fraud.checkOtThreshold(updated, req.user.id);
    await fraud.checkHrEditVolume(req.user.id);

    res.json(updated);
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] attendance error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const remove = async (req, res) => {
  try {
    const old = await pool.query('SELECT * FROM attendance WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Attendance record not found.' });

    const record = old.rows[0];
    if (record.approved && req.user.role !== 'admin') {
      return res.status(409).json({ error: 'Cannot delete an approved record.' });
    }
    if (await isDateLocked(record.date)) {
      return res.status(409).json({ error: 'This period is locked.' });
    }

    await pool.query('DELETE FROM attendance WHERE id = $1', [req.params.id]);

    await audit.log({
      userId: req.user.id,
      action: 'DELETE_ATTENDANCE',
      tableName: 'attendance',
      recordId: parseInt(req.params.id),
      oldValue: old.rows[0],
      ipAddress: req.ip,
    });

    res.json({ message: 'Attendance record deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const approve = async (req, res) => {
  try {
    const old = await pool.query('SELECT * FROM attendance WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Attendance record not found.' });

    if (old.rows[0].approved) {
      return res.status(409).json({ error: 'Already approved.' });
    }

    const result = await pool.query(
      `UPDATE attendance
       SET approved = TRUE, approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    const updated = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'APPROVE_ATTENDANCE',
      tableName: 'attendance',
      recordId: updated.id,
      oldValue: { approved: false },
      newValue: { approved: true, approved_by: req.user.id },
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Bulk approve
const bulkApprove = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE attendance
       SET approved = TRUE, approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = ANY($2::int[]) AND approved = FALSE
       RETURNING id`,
      [req.user.id, ids]
    );

    await audit.log({
      userId: req.user.id,
      action: 'BULK_APPROVE_ATTENDANCE',
      tableName: 'attendance',
      newValue: { approved_ids: result.rows.map((r) => r.id) },
      ipAddress: req.ip,
    });

    res.json({ approved: result.rows.length, ids: result.rows.map((r) => r.id) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getAll, create, update, remove, approve, bulkApprove };
