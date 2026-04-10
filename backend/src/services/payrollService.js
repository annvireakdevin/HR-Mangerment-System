const pool = require('../config/database');

/**
 * Calculate payroll for one or more employees within a date range.
 * Only approved attendance records are included.
 *
 * @param {object} opts
 * @param {string} opts.startDate  - ISO date string 'YYYY-MM-DD'
 * @param {string} opts.endDate    - ISO date string 'YYYY-MM-DD'
 * @param {number} [opts.employeeId]  - filter by employee (optional)
 * @param {number} [opts.positionId]  - filter by position (optional)
 * @returns {Array} payroll rows
 */
const calculate = async ({ startDate, endDate, employeeId, positionId }) => {
  let query = `
    SELECT
      e.id               AS employee_id,
      e.name             AS employee_name,
      p.id               AS position_id,
      p.name             AS position_name,
      p.hourly_rate,
      p.ot_multiplier,
      COALESCE(SUM(CASE WHEN a.status = 'present' THEN a.hours_worked ELSE 0 END), 0) AS total_hours,
      COALESCE(SUM(CASE WHEN a.status = 'present' THEN a.ot_hours ELSE 0 END), 0)     AS total_ot_hours,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END)  AS days_present,
      COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)  AS days_absent
    FROM employees e
    JOIN positions p ON e.position_id = p.id
    LEFT JOIN attendance a
      ON a.employee_id = e.id
      AND a.date BETWEEN $1 AND $2
      AND a.approved = TRUE
    WHERE e.active = TRUE
  `;

  const params = [startDate, endDate];
  let idx = 3;

  if (employeeId) {
    query += ` AND e.id = $${idx++}`;
    params.push(employeeId);
  }
  if (positionId) {
    query += ` AND p.id = $${idx++}`;
    params.push(positionId);
  }

  query += ' GROUP BY e.id, e.name, p.id, p.name, p.hourly_rate, p.ot_multiplier ORDER BY e.name';

  const result = await pool.query(query, params);

  return result.rows.map((row) => {
    const rate = parseFloat(row.hourly_rate);
    const otMult = parseFloat(row.ot_multiplier);
    const totalHours = parseFloat(row.total_hours);
    const totalOtHours = parseFloat(row.total_ot_hours);

    const regularPay = totalHours * rate;
    const otPay = totalOtHours * (rate * otMult);
    const totalSalary = regularPay + otPay;

    return {
      employee_id: row.employee_id,
      employee_name: row.employee_name,
      position_id: row.position_id,
      position_name: row.position_name,
      hourly_rate: rate,
      ot_multiplier: otMult,
      total_hours: totalHours,
      total_ot_hours: totalOtHours,
      days_present: parseInt(row.days_present),
      days_absent: parseInt(row.days_absent),
      regular_pay: parseFloat(regularPay.toFixed(2)),
      ot_pay: parseFloat(otPay.toFixed(2)),
      total_salary: parseFloat(totalSalary.toFixed(2)),
    };
  });
};

module.exports = { calculate };
