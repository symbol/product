const completedController = require('../controllers/completedController');
const optinRequestsController = require('../controllers/optinRequestsController');
const versionController = require('../controllers/versionController');
const Validation = require('../utils/Validation');
const express = require('express');

const router = express.Router();

router.get('/completed', Validation.validate('getCompleted'), Validation.error, completedController.getCompleted);
router.get('/completed/download', Validation.validate('exportCsv'), Validation.error, completedController.exportCsv);

router.get('/requests', Validation.validate('getOptinRequests'), Validation.error, optinRequestsController.getOptinRequests);
router.get('/requests/download', Validation.validate('exportCsv'), Validation.error, optinRequestsController.exportCsv);

router.get('/version', versionController.getVersion);

module.exports = router;
