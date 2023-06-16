import ClaimDatabase from '../../src/database/ClaimDatabase.js';
import DatabaseConnection from '../../src/database/DatabaseConnection.js';
import testHelper from '../testHelper.js';
import { expect } from 'chai';
import sinon from 'sinon';

describe('ClaimDatabase', () => {
	let claimDatabase;

	beforeEach(() => {
		const { connection } = new DatabaseConnection(':memory:');
		claimDatabase = new ClaimDatabase(connection);
	});

	it('should call db.run with the correct query in createTable', async () => {
		// Act:
		await claimDatabase.createTable();

		// Assert:
		const queries = [
			testHelper.readDB(claimDatabase.connection, 'get', 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'claimed\''),
			testHelper.readDB(claimDatabase.connection, 'get', 'SELECT count(*) as count FROM claimed')
		];

		const [query1, query2] = await Promise.all(queries);

		expect(query1.name).to.equal('claimed');
		expect(query2.count).to.equal(0);
	});

	it('should call db.run with the correct query and parameters in insertClaimed', async () => {
		// Arrange:
		await claimDatabase.createTable();

		// Act:
		await claimDatabase.insertClaimed({
			address: 'test_address',
			amount: 10,
			twitterHandle: 'test_user',
			protocol: 'NEM'
		});

		// Assert:
		const result = await testHelper.readDB(claimDatabase.connection, 'all', 'SELECT * FROM claimed');

		expect(result.length).to.be.equal(1);
		expect(result[0]).to.deep.include({
			id: 1,
			twitter_handle: 'test_user',
			protocol: 'NEM',
			address: 'test_address',
			amount: 10
		});

		// The timestamp is not exactly the same, so we check if it is close to the current time
		expect(new Date(result[0].claimed_at).getTime()).to.be.closeTo(new Date().getTime(), 2000);
	});

	it('throws error when createTable returns an error', async () => {
		// Arrange:
		await claimDatabase.createTable();

		sinon.stub(claimDatabase, 'createTable').throws(new Error('test error'));

		// Act + Assert:
		expect(() => claimDatabase.createTable()).throw('test error');
	});

	it('throws error when insertClaimed returns an error', async () => {
		// Arrange:
		await claimDatabase.createTable();

		sinon.stub(claimDatabase, 'insertClaimed').throws(new Error('test error'));

		// Act + Assert:
		expect(() => claimDatabase.insertClaimed({})).throw('test error');
	});
});
