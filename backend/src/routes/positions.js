const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/positionController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/',    authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/',   authenticate, authorize('admin'), ctrl.create);
router.put('/:id', authenticate, authorize('admin'), ctrl.update);

module.exports = router;
