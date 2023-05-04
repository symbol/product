import DatabaseConnection from '../../src/database/DatabaseConnection.js';
import testHelper from '../testHelper.js';
import { expect } from 'chai';
import sqlite3 from 'sqlite3';

const { Database } = sqlite3.verbose();

describe('DatabaseConnection', () => {
	it('should create a new instance of database connection', async () => {
		// Arrange + Act:
		const { connection } = new DatabaseConnection(':memory:');

		// Assert:
		const result = await testHelper.readDB(connection, 'get', 'SELECT count(*) as count FROM sqlite_master');

		expect(connection).to.be.an.instanceOf(Database);
		expect(result.count).to.be.equal(0);
	});
});
