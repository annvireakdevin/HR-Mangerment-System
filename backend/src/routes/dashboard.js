const express = require('express');
const router = express.Router();
const { getMetrics } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', authenticate, authorize('admin', 'hr', 'manager'), getMetrics);

module.exports = router;
