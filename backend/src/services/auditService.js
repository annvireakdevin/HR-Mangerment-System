const pool = require('../config/database');

/**
 * Write an entry to the audit_logs table.
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string} opts.action  - e.g. 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'LOCK', 'UNLOCK'
 * @param {string} opts.tableName
 * @param {number} [opts.recordId]
 * @param {object} [opts.oldValue]
 * @param {object} [opts.newValue]
 * @param {string} [opts.ipAddress]
 */
const log = async ({ userId, action, tableName, recordId, oldValue, newValue, ipAddress }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        tableName,
        recordId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress || null,
      ]
    );
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] Audit log write failed: ${err.message}\n`);
  }
};

module.exports = { log };
