const pool = require('../config/database');
const audit = require('../services/auditService');

const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.name, e.email, e.active, e.created_at,
              p.id AS position_id, p.name AS position_name, p.hourly_rate
       FROM employees e
       LEFT JOIN positions p ON p.id = e.position_id
       ORDER BY e.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getOne = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.name, e.email, e.active, e.created_at,
              p.id AS position_id, p.name AS position_name, p.hourly_rate
       FROM employees e
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Basic email format check (no external dependency needed)
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const create = async (req, res) => {
  const { name, email, position_id } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO employees (name, email, position_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, email || null, position_id || null]
    );
    const employee = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'CREATE_EMPLOYEE',
      tableName: 'employees',
      recordId: employee.id,
      newValue: employee,
      ipAddress: req.ip,
    });

    res.status(201).json(employee);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists.' });
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const update = async (req, res) => {
  const { name, email, position_id, active } = req.body;
  if (email !== undefined && email !== null && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const old = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Employee not found.' });

    const result = await pool.query(
      `UPDATE employees
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           position_id = COALESCE($3, position_id),
           active = COALESCE($4, active),
           updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, email, position_id, active, req.params.id]
    );
    const updated = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'UPDATE_EMPLOYEE',
      tableName: 'employees',
      recordId: updated.id,
      oldValue: old.rows[0],
      newValue: updated,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists.' });
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const remove = async (req, res) => {
  try {
    const old = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Employee not found.' });

    // Soft delete
    await pool.query('UPDATE employees SET active = FALSE, updated_at = NOW() WHERE id = $1', [req.params.id]);

    await audit.log({
      userId: req.user.id,
      action: 'DELETE_EMPLOYEE',
      tableName: 'employees',
      recordId: parseInt(req.params.id),
      oldValue: old.rows[0],
      ipAddress: req.ip,
    });

    res.json({ message: 'Employee deactivated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getAll, getOne, create, update, remove };
