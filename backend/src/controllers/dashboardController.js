const pool = require('../config/database');

const getMetrics = async (req, res) => {
  // Default to current month
  const now = new Date();
  const start = req.query.start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end   = req.query.end_date   || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  try {
    // Total salary & OT cost
    const salaryResult = await pool.query(
      `SELECT
         COALESCE(SUM(a.hours_worked * p.hourly_rate), 0) AS total_regular_pay,
         COALESCE(SUM(a.ot_hours * (p.hourly_rate * p.ot_multiplier)), 0) AS total_ot_pay
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       JOIN positions p ON p.id = e.position_id
       WHERE a.approved = TRUE
         AND a.date BETWEEN $1 AND $2`,
      [start, end]
    );

    // Salary per position
    const positionResult = await pool.query(
      `SELECT
         p.name AS position_name,
         COALESCE(SUM(a.hours_worked * p.hourly_rate + a.ot_hours * (p.hourly_rate * p.ot_multiplier)), 0) AS total_salary,
         COUNT(DISTINCT e.id) AS employee_count
       FROM positions p
       LEFT JOIN employees e ON e.position_id = p.id AND e.active = TRUE
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.approved = TRUE AND a.date BETWEEN $1 AND $2
       GROUP BY p.id, p.name
       ORDER BY total_salary DESC`,
      [start, end]
    );

    // Top OT employees
    const topOtResult = await pool.query(
      `SELECT e.name AS employee_name, SUM(a.ot_hours) AS total_ot,
              p.name AS position_name
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       JOIN positions p ON p.id = e.position_id
       WHERE a.approved = TRUE AND a.date BETWEEN $1 AND $2
       GROUP BY e.id, e.name, p.name
       ORDER BY total_ot DESC
       LIMIT 5`,
      [start, end]
    );

    // Total employee count
    const empCount = await pool.query('SELECT COUNT(*) FROM employees WHERE active = TRUE');

    // Active fraud alerts
    const fraudCount = await pool.query(
      'SELECT COUNT(*) FROM fraud_alerts WHERE resolved = FALSE'
    );

    // Recent fraud alerts
    const fraudAlerts = await pool.query(
      `SELECT fa.*, e.name AS employee_name
       FROM fraud_alerts fa
       LEFT JOIN employees e ON e.id = fa.employee_id
       WHERE fa.resolved = FALSE
       ORDER BY fa.created_at DESC
       LIMIT 5`
    );

    const metrics = salaryResult.rows[0];
    const totalSalary =
      parseFloat(metrics.total_regular_pay) + parseFloat(metrics.total_ot_pay);

    res.json({
      period: { start, end },
      total_salary: parseFloat(totalSalary.toFixed(2)),
      total_ot_cost: parseFloat(parseFloat(metrics.total_ot_pay).toFixed(2)),
      total_employees: parseInt(empCount.rows[0].count),
      active_fraud_alerts: parseInt(fraudCount.rows[0].count),
      salary_by_position: positionResult.rows.map((r) => ({
        ...r,
        total_salary: parseFloat(parseFloat(r.total_salary).toFixed(2)),
      })),
      top_ot_employees: topOtResult.rows.map((r) => ({
        ...r,
        total_ot: parseFloat(r.total_ot),
      })),
      recent_fraud_alerts: fraudAlerts.rows,
    });
  } catch (err) {
    process.stderr.write(`[${new Date().toISOString()}] dashboard error: ${err}\n`);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getMetrics };
