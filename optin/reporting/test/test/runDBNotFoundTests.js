const Config = require('../../config');
const { refreshDBs } = require('../../models/database');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

const runDBNotFoundTests = ({ paginationFunc, parameters }) => {
	beforeEach(restore);
	it('throw error if db not found', async () => {
		try {
			// Arrange:
			stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../path/notFound'));
			refreshDBs();

			await paginationFunc(parameters);
		} catch (error) {
			// Assert:
			expect(error.message).to.be.equal('Database error :SQLITE_CANTOPEN: unable to open database file');
		}
	});
};

module.exports = runDBNotFoundTests;
