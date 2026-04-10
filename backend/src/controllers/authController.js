const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const audit = require('../services/auditService');

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role, u.active, u.employee_id,
              e.name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.username = $1`,
      [username]
    );
    const user = result.rows[0];

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await audit.log({
      userId: user.id,
      action: 'LOGIN',
      tableName: 'users',
      recordId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employee_id: user.employee_id,
        employee_name: user.employee_name,
      },
    });
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] login error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.role, u.employee_id, u.last_login,
              e.name AS employee_name, p.name AS position_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { login, getMe };
