const { Sequelize } = require('sequelize');

const dbList = ['completed', 'in_progress'];

const database = {};

const refreshDBs = () => {
	for (let i = 0; i <= dbList.length - 1; i++) {
		const db = dbList[i];
		database[db] = new Sequelize(db, null, null, {
			dialect: 'sqlite',
			storage: `./data/${db}.db`
		});
	}
	return database;
};
refreshDBs();
setInterval(refreshDBs, 60 * 1000);

const getDatabase = () => database;

module.exports = getDatabase;
