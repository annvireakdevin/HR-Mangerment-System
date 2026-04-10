const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employeeController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/',     authenticate, authorize('admin', 'hr', 'manager'), ctrl.getAll);
router.get('/:id',  authenticate, authorize('admin', 'hr', 'manager'), ctrl.getOne);
router.post('/',    authenticate, authorize('admin'), ctrl.create);
router.put('/:id',  authenticate, authorize('admin'), ctrl.update);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
