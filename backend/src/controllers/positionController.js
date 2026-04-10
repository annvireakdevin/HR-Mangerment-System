const pool = require('../config/database');
const audit = require('../services/auditService');
const fraud = require('../services/fraudService');

const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM positions ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getOne = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM positions WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Position not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const create = async (req, res) => {
  const { name, hourly_rate, ot_multiplier } = req.body;
  if (!name || !hourly_rate) {
    return res.status(400).json({ error: 'Name and hourly_rate are required.' });
  }
  const rate = parseFloat(hourly_rate);
  if (!isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: 'hourly_rate must be a positive number.' });
  }
  if (ot_multiplier !== undefined) {
    const mult = parseFloat(ot_multiplier);
    if (!isFinite(mult) || mult <= 0) {
      return res.status(400).json({ error: 'ot_multiplier must be a positive number.' });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO positions (name, hourly_rate, ot_multiplier)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, rate, ot_multiplier || 1.5]
    );
    const position = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'CREATE_POSITION',
      tableName: 'positions',
      recordId: position.id,
      newValue: position,
      ipAddress: req.ip,
    });

    res.status(201).json(position);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Position name already exists.' });
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const update = async (req, res) => {
  const { name, hourly_rate, ot_multiplier } = req.body;

  try {
    const old = await pool.query('SELECT * FROM positions WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Position not found.' });

    if (hourly_rate !== undefined) {
      const rate = parseFloat(hourly_rate);
      if (!isFinite(rate) || rate <= 0) return res.status(400).json({ error: 'hourly_rate must be a positive number.' });
    }
    if (ot_multiplier !== undefined) {
      const mult = parseFloat(ot_multiplier);
      if (!isFinite(mult) || mult <= 0) return res.status(400).json({ error: 'ot_multiplier must be a positive number.' });
    }

    const result = await pool.query(
      `UPDATE positions
       SET name = COALESCE($1, name),
           hourly_rate = COALESCE($2, hourly_rate),
           ot_multiplier = COALESCE($3, ot_multiplier),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, hourly_rate, ot_multiplier, req.params.id]
    );
    const updated = result.rows[0];

    await audit.log({
      userId: req.user.id,
      action: 'UPDATE_POSITION',
      tableName: 'positions',
      recordId: updated.id,
      oldValue: old.rows[0],
      newValue: updated,
      ipAddress: req.ip,
    });

    // Fraud check: rate increase > 50%
    if (hourly_rate) {
      await fraud.checkSalaryIncrease(
        updated.id,
        parseFloat(old.rows[0].hourly_rate),
        parseFloat(hourly_rate),
        req.user.id
      );
    }

    res.json(updated);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Position name already exists.' });
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getAll, getOne, create, update };
