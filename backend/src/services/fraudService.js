const pool = require('../config/database');

/**
 * Insert a fraud alert into the database.
 */
const createAlert = async ({ alertType, description, employeeId, triggeredByUser }) => {
  await pool.query(
    `INSERT INTO fraud_alerts (alert_type, description, employee_id, triggered_by_user)
     VALUES ($1, $2, $3, $4)`,
    [alertType, description, employeeId || null, triggeredByUser || null]
  );
};

/**
 * Rule 1: OT > 5 hours on a single day for a given employee.
 */
const checkOtThreshold = async (attendanceRecord, triggeredByUser) => {
  if (parseFloat(attendanceRecord.ot_hours) > 5) {
    await createAlert({
      alertType: 'HIGH_OT',
      description: `Employee ID ${attendanceRecord.employee_id} logged ${attendanceRecord.ot_hours}h OT on ${attendanceRecord.date} (threshold: 5h).`,
      employeeId: attendanceRecord.employee_id,
      triggeredByUser,
    });
  }
};

/**
 * Rule 2: HR user edits more than 20 attendance records in a single day.
 */
const checkHrEditVolume = async (hrUserId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS edit_count
     FROM audit_logs
     WHERE user_id = $1
       AND action IN ('CREATE_ATTENDANCE', 'UPDATE_ATTENDANCE')
       AND created_at::date = CURRENT_DATE`,
    [hrUserId]
  );
  const count = parseInt(result.rows[0].edit_count);
  if (count > 20) {
    await createAlert({
      alertType: 'EXCESSIVE_HR_EDITS',
      description: `HR user ID ${hrUserId} has made ${count} attendance edits today (threshold: 20).`,
      triggeredByUser: hrUserId,
    });
  }
};

/**
 * Rule 3: Position hourly_rate increased by more than 50%.
 */
const checkSalaryIncrease = async (positionId, oldRate, newRate, triggeredByUser) => {
  if (oldRate > 0) {
    const increase = ((newRate - oldRate) / oldRate) * 100;
    if (increase > 50) {
      await createAlert({
        alertType: 'LARGE_RATE_INCREASE',
        description: `Position ID ${positionId} hourly rate increased ${increase.toFixed(1)}% (from ${oldRate} to ${newRate}). Threshold: 50%.`,
        triggeredByUser,
      });
    }
  }
};

module.exports = { checkOtThreshold, checkHrEditVolume, checkSalaryIncrease };
