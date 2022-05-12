const { Sequelize } = require('sequelize');
const sqlite3 = require('sqlite3');

const dbList = ['completed', 'in_progress'];

const database = {};

const refreshDBs = () => {
	dbList.forEach(db => {
		database[db] = new Sequelize(db, null, null, {
			dialect: 'sqlite',
			storage: `./data/${db}.db`,
			dialectOptions: {
				mode: sqlite3.OPEN_READONLY
			}
		});
	});

	return database;
};
refreshDBs();
setInterval(refreshDBs, 60 * 1000);

const getDatabase = () => database;

module.exports = getDatabase;
