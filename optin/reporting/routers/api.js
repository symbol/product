const express = require('express');
const router = express.Router();
const balancesController = require('../controllers/balancesController')

router.get('/balances', balancesController.balances);

module.exports = router;