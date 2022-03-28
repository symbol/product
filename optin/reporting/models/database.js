const { Sequelize } = require('sequelize');

const list = ['balances', 'completed', 'in_progress', 'multisig'];

const database = {}

for(let i = 0; i <= list.length - 1; i++) {
    let db = list[i];
    database[db] = new Sequelize(db, null, null, {
      dialect: 'sqlite',
      storage: `./data/${db}.db`
    });
}

module.exports = database;
