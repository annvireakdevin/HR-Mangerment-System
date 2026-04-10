const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/',                         authenticate, authorize('admin', 'hr'), ctrl.getLogs);
router.get('/fraud-alerts',             authenticate, authorize('admin', 'hr', 'manager'), ctrl.getFraudAlerts);
router.put('/fraud-alerts/:id/resolve', authenticate, authorize('admin', 'manager'), ctrl.resolveFraudAlert);

module.exports = router;
