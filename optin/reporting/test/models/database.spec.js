const { getDatabase } = require('../../models/database');
const { expect } = require('chai');
const sqlite3 = require('sqlite3');

const runBasicDatabaseInstanceTests = (database, databaseName) => {
	it(`returns ${databaseName} sequelize instance`, () => {
		// Assert:
		expect(database.config.database).to.be.equal(databaseName);
		expect(database.options.storage).to.be.equal(`./_data/${databaseName}.db`);
		expect(database.options.dialectOptions.mode).to.be.equal(sqlite3.OPEN_READONLY);
	});
};

describe('database', () => {
	describe('completed db', () => {
		// Arrange + Act:
		const { completed } = getDatabase();

		runBasicDatabaseInstanceTests(completed, 'completed');
	});

	describe('in_progress db', () => {
		// Arrange + Act:
		const { in_progress } = getDatabase();

		runBasicDatabaseInstanceTests(in_progress, 'in_progress');
	});
});
