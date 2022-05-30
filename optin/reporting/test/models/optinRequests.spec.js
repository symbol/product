const runDBNotFoundTests = require('./runDBNotFoundTests');
const runTotalRecordTests = require('./runTotalRecordTests');
const Config = require('../../config');
const { refreshDBs } = require('../../models/database');
const optinRequestDB = require('../../models/optinRequests');
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
			const firstTimestamps = result[0].optinTransactionHeight;
			const lastTimestamps = result[result.length - 1].optinTransactionHeight;

			expect(firstTimestamps > lastTimestamps).to.be.equal(true);
			expect(firstTimestamps < lastTimestamps).to.be.equal(false);
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
			const firstTimestamps = result[0].payoutTimestamp;
			const lastTimestamps = result[result.length - 1].payoutTimestamp;

			expect(firstTimestamps > lastTimestamps).to.be.equal(true);
			expect(firstTimestamps < lastTimestamps).to.be.equal(false);
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
			const firstTimestamps = result[0].optinTimestamp;
			const lastTimestamps = result[result.length - 1].optinTimestamp;

			expect(firstTimestamps > lastTimestamps).to.be.equal(true);
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
