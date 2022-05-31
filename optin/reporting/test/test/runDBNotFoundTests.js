const Config = require('../../config');
const { refreshDBs } = require('../../models/database');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { stub, restore } = require('sinon');
const path = require('path');

const { expect } = chai;

chai.use(chaiAsPromised);

const runDBNotFoundTests = ({ paginationFunc, parameters }) => {
	beforeEach(restore);
	it('renders error when db not found', async () => {
		// Arrange:
		stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../path/notFound'));
		refreshDBs();

		// Assert:
		await expect(paginationFunc(parameters)).rejectedWith('SQLITE_CANTOPEN: unable to open database file');
	});
};

module.exports = runDBNotFoundTests;
