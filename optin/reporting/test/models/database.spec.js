const { getDatabase, refreshDBs } = require('../../models/database');
const { expect } = require('chai');
const { restore } = require('sinon');
const sqlite3 = require('sqlite3');

describe('database', () => {
	beforeEach(() => {
		restore();
		refreshDBs();
	});

	const database = getDatabase();

	Object.keys(database).forEach(dbName => {
		it(`returns ${dbName} sequelize instance`, () => {
			// Arrange:
			const dbInstance = database[dbName];

			// Act + Assert:
			expect(dbInstance.config.database).to.be.equal(dbName);
			expect(dbInstance.options.storage).to.be.equal(`./_data/${dbName}.db`);
			expect(dbInstance.options.dialectOptions.mode).to.be.equal(sqlite3.OPEN_READONLY);
		});
	});
});
