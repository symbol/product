const completedController = require('../controllers/completedController');
const optinRequestsController = require('../controllers/optinRequestsController');
const versionController = require('../controllers/versionController');
const express = require('express');

const router = express.Router();

router.get('/completed', completedController.getCompleted);
router.get('/completed/download', completedController.exportCsv);

router.get('/requests', optinRequestsController.getOptinRequests);
router.get('/requests/download', optinRequestsController.exportCsv);

router.get('/version', versionController.getVersion);

module.exports = router;
