const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payrollController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/',          authenticate, authorize('admin', 'hr', 'manager', 'employee'), ctrl.getSummary);
router.get('/locks',     authenticate, authorize('admin', 'hr', 'manager'), ctrl.getLocks);
router.post('/locks',    authenticate, authorize('admin'), ctrl.createLock);
router.put('/locks/:id', authenticate, authorize('admin'), ctrl.toggleLock);

module.exports = router;
