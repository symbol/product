const Sequelize = require('sequelize');
const { balances } = require('./database');

const snapshotBalances = balances.define('snapshotBalances', {
    address: {
        type: Sequelize.BLOB,
        primaryKey: true
    },
    balance: Sequelize.INTEGER
  }, {
    timestamps: false,
    createdAt: false,
    tableName: 'snapshot_balances'
  });

  module.exports = snapshotBalances