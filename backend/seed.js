/**
 * Seed the database with initial positions, employees, and user accounts.
 * Run: node seed.js
 *
 * Default credentials:
 *   admin    / admin123
 *   hr       / hr123
 *   manager  / manager123
 *   employee / employee123
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Run migrations
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'init.sql'), 'utf8');
    await client.query(sql);
    console.log('✓ Schema created');

    // Positions
    const positions = [
      { name: 'Software Engineer', hourly_rate: 35.00, ot_multiplier: 1.5 },
      { name: 'Product Manager',   hourly_rate: 40.00, ot_multiplier: 1.5 },
      { name: 'Designer',          hourly_rate: 28.00, ot_multiplier: 1.5 },
      { name: 'Support Agent',     hourly_rate: 18.00, ot_multiplier: 1.5 },
      { name: 'HR Specialist',     hourly_rate: 25.00, ot_multiplier: 1.5 },
    ];

    const posIds = {};
    for (const pos of positions) {
      const r = await client.query(
        `INSERT INTO positions (name, hourly_rate, ot_multiplier)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate
         RETURNING id, name`,
        [pos.name, pos.hourly_rate, pos.ot_multiplier]
      );
      posIds[r.rows[0].name] = r.rows[0].id;
    }
    console.log('✓ Positions seeded');

    // Employees
    const employees = [
      { name: 'Alice Admin',    email: 'alice@company.com',   position: 'Product Manager' },
      { name: 'Henry HR',       email: 'henry@company.com',   position: 'HR Specialist' },
      { name: 'Mike Manager',   email: 'mike@company.com',    position: 'Product Manager' },
      { name: 'Eve Engineer',   email: 'eve@company.com',     position: 'Software Engineer' },
      { name: 'Sam Support',    email: 'sam@company.com',     position: 'Support Agent' },
      { name: 'Diana Designer', email: 'diana@company.com',   position: 'Designer' },
    ];

    const empIds = {};
    for (const emp of employees) {
      const r = await client.query(
        `INSERT INTO employees (name, email, position_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [emp.name, emp.email, posIds[emp.position]]
      );
      empIds[emp.name] = r.rows[0].id;
    }
    console.log('✓ Employees seeded');

    // Users
    const users = [
      { username: 'admin',    password: 'admin123',    role: 'admin',    employee: 'Alice Admin' },
      { username: 'hr',       password: 'hr123',       role: 'hr',       employee: 'Henry HR' },
      { username: 'manager',  password: 'manager123',  role: 'manager',  employee: 'Mike Manager' },
      { username: 'employee', password: 'employee123', role: 'employee', employee: 'Eve Engineer' },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, ROUNDS);
      await client.query(
        `INSERT INTO users (username, password_hash, role, employee_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [u.username, hash, u.role, empIds[u.employee]]
      );
    }
    console.log('✓ Users seeded');

    // Sample attendance for the current month
    const today = new Date();
    const year  = today.getFullYear();
    const month = today.getMonth();

    const attendanceEmployees = ['Eve Engineer', 'Sam Support', 'Diana Designer'];
    for (const empName of attendanceEmployees) {
      const empId = empIds[empName];
      // Add 5 days of attendance
      for (let d = 1; d <= 5; d++) {
        const date = new Date(year, month, d);
        if (date > today) break;
        const dateStr = date.toISOString().split('T')[0];
        const hoursWorked = 8;
        const otHours = d === 3 ? 2 : 0; // day 3 has OT
        await client.query(
          `INSERT INTO attendance (employee_id, date, hours_worked, ot_hours, status, approved, created_by)
           VALUES ($1, $2, $3, $4, 'present', TRUE, 1)
           ON CONFLICT (employee_id, date) DO NOTHING`,
          [empId, dateStr, hoursWorked, otHours]
        ).catch(() => {}); // ignore if user id 1 doesn't exist yet
      }
    }
    console.log('✓ Sample attendance seeded');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!');
    console.log('\nDefault login credentials:');
    console.log('  admin    / admin123');
    console.log('  hr       / hr123');
    console.log('  manager  / manager123');
    console.log('  employee / employee123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
