const balancesController = require('../controllers/balancesController');
const completedController = require('../controllers/completedController');
const express = require('express');

const router = express.Router();

router.get('/balances', balancesController.getBalance);
router.get('/completed', completedController.getCompleted);

module.exports = router;
