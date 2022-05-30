const Config = require('../../config');
const { refreshDBs } = require('../../models/database');
const optinRequestDB = require('../../models/optinRequests');
const runDBNotFoundTests = require('../test/runDBNotFoundTests');
const runTotalRecordTests = require('../test/runTotalRecordTests');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

describe('optinRequest models', () => {
	const parameters = {
		nemAddressBytes: null,
		transactionHashBytes: null,
		status: null,
		pageNumber: 1,
		pageSize: 10
	};

	beforeEach(() => {
		stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../resources'));
		refreshDBs();
	});

	afterEach(restore);

	describe('verify if database exists', () => {
		runDBNotFoundTests({
			paginationFunc: optinRequestDB.getOptinRequestPagination,
			parameters
		});
	});

	describe('getOptinRequestPagination', () => {
		it('returns basic records', async () => {
			// Arrange + Act:
			const result = await optinRequestDB.getOptinRequestPagination({
				...parameters
			});

			// Assert:
			result.forEach(item => {
				expect(item).to.have.property('optinTransactionHeight');
				expect(item).to.have.property('nemAddressBytes');
				expect(item).to.have.property('optinTransactionHashHex');
				expect(item).to.have.property('payoutTransactionHeight');
				expect(item).to.have.property('payoutTransactionHash');
				expect(item).to.have.property('payoutStatus');
				expect(item).to.have.property('message');
				expect(item).to.have.property('optinTimestamp');
				expect(item).to.have.property('payoutTimestamp');
			});
		});

		it('returns sorted transaction height in descending given invalid sortBy', async () => {
			// Arrange:
			const sort = {
				sortBy: 'invalid',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await optinRequestDB.getOptinRequestPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.optinTransactionHeight - a.optinTransactionHeight);

			result.forEach((item, index) => {
				expect(item.optinTransactionHeight).to.be.equal(sortedResult[index].optinTransactionHeight);
			});
		});

		it('returns sorted payout transaction hash records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'payoutTransactionHash',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await optinRequestDB.getOptinRequestPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.payoutTimestamp - a.payoutTimestamp);

			result.forEach((item, index) => {
				expect(item.payoutTimestamp).to.be.equal(sortedResult[index].payoutTimestamp);
			});
		});

		it('returns sorted optin transaction hash records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'optinTransactionHash',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await optinRequestDB.getOptinRequestPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.optinTimestamp - a.optinTimestamp);

			result.forEach((item, index) => {
				expect(item.optinTimestamp).to.be.equal(sortedResult[index].optinTimestamp);
			});
		});
	});

	describe('getTotalRecord', () => {
		runTotalRecordTests({
			database: optinRequestDB,
			parameters: {
				nemAddressBytes: null,
				transactionHashBytes: null,
				status: null
			},
			expectedResult: 12
		});
	});
});
