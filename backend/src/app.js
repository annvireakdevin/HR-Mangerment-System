require('dotenv').config();

// Fail fast if required secrets are missing
if (!process.env.JWT_SECRET) {
  process.stderr.write('FATAL: JWT_SECRET environment variable is not set.\n');
  process.exit(1);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// CORS — require explicit FRONTEND_URL; no localhost fallback in production
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin) {
  process.stderr.write('FATAL: FRONTEND_URL environment variable is not set.\n');
  process.exit(1);
}
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Request logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Handle payload too large
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large.' });
  }
  next(err);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Strict rate limit on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/positions',  require('./routes/positions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/payroll',    require('./routes/payroll'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/audit-logs', require('./routes/auditLogs'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Global error handler — never leak stack traces to the client
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  process.stderr.write(`[${new Date().toISOString()}] Unhandled error: ${err.stack || err}\n`);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  process.stdout.write(`HRMS API running on port ${PORT} (${process.env.NODE_ENV || 'development'})\n`);
});

module.exports = app;
