const balancesController = require('../controllers/balancesController');
const completedController = require('../controllers/completedController');
const optinRequestsController = require('../controllers/optinRequestsController');
const express = require('express');

const router = express.Router();

router.get('/balances', balancesController.getBalance);
router.get('/completed', completedController.getCompleted);
router.get('/requests', optinRequestsController.getOptinRequests);

module.exports = router;
