const balancesController = require('../controllers/balancesController');
const express = require('express');

const router = express.Router();

router.get('/balances', balancesController.balances);

module.exports = router;
