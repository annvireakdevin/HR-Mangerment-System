const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/',               authenticate, authorize('admin', 'hr', 'manager', 'employee'), ctrl.getAll);
router.post('/',              authenticate, authorize('admin', 'hr'), ctrl.create);
router.put('/:id',            authenticate, authorize('admin', 'hr'), ctrl.update);
router.delete('/:id',         authenticate, authorize('admin', 'hr'), ctrl.remove);
router.post('/:id/approve',   authenticate, authorize('admin', 'manager'), ctrl.approve);
router.post('/bulk-approve',  authenticate, authorize('admin', 'manager'), ctrl.bulkApprove);

module.exports = router;
