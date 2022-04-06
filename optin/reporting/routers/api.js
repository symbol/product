const completedController = require('../controllers/completedController');
const optinRequestsController = require('../controllers/optinRequestsController');
const express = require('express');

const router = express.Router();

router.get('/completed', completedController.getCompleted);
router.get('/requests', optinRequestsController.getOptinRequests);
router.get('/requests/download', optinRequestsController.exportCsv);

module.exports = router;
