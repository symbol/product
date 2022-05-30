const Config = require('../../config');
const completedDB = require('../../models/completed');
const { refreshDBs } = require('../../models/database');
const runDBNotFoundTests = require('../test/runDBNotFoundTests');
const runTotalRecordTests = require('../test/runTotalRecordTests');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

const runBasicOptinTypeTests = (types, parameters) => {
	/* eslint-disable no-await-in-loop */
	for (let i = 0; i <= types.length - 1; ++i) {
		// Arrange:
		const optinType = types[i];

		it(`returns ${0 === optinType ? 'pre' : 'post'}-optin records`, async () => {
			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				optinType
			});

			// Assert:
			result.forEach(item => {
				expect(item.isPostoptin).to.be.equal(optinType);
			});
		});
	}
};

describe('completed models', () => {
	const parameters = {
		nemAddressHex: null,
		optinType: null,
		pageNumber: 1,
		pageSize: 10,
		sortBy: '',
		sortDirection: '',
		symbolAddressHex: null,
		txHash: null
	};

	beforeEach(() => {
		stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../resources'));
		refreshDBs();
	});

	afterEach(restore);

	describe('verify if database exists', () => {
		runDBNotFoundTests({
			paginationFunc: completedDB.getCompletedPagination,
			parameters
		});
	});

	describe('getCompletedPagination', () => {
		describe('optin type', () => {
			runBasicOptinTypeTests([0, 1], parameters);
		});

		it('returns basic records', async () => {
			// Arrange + Act:
			const result = await completedDB.getCompletedPagination({
				...parameters
			});

			// Assert:
			result.forEach(item => {
				expect(item).to.have.property('id');
				expect(item).to.have.property('isPostoptin');
				expect(item).to.have.property('symbolTimestamp');
				item.nemSource.forEach(source => {
					expect(source).to.have.property('address');
					expect(source).to.have.property('balance');
					expect(source).to.have.property('hashes');
					expect(source).to.have.property('height');
					expect(source).to.have.property('timestamps');
					expect(source).to.have.property('label');
				});
				item.symbolDestination.forEach(source => {
					expect(source).to.have.property('address');
					expect(source).to.have.property('balance');
					expect(source).to.have.property('hashes');
					expect(source).to.have.property('height');
					expect(source).to.have.property('timestamps');
				});
			});
		});

		it('returns sorted id in descending given invalid sortBy', async () => {
			// Arrange:
			const sort = {
				sortBy: 'invalid',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.id - a.id);

			result.forEach((item, index) => {
				expect(item.id).to.be.equal(sortedResult[index].id);
			});
		});

		it('returns sorted nem timestamp records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'nemHashes',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.nemSource[0].timestamps - a.nemSource[0].timestamps);

			result.forEach((item, index) => {
				expect(item.nemSource[0].timestamps).to.be.equal(sortedResult[index].nemSource[0].timestamps);
			});
		});

		it('returns sorted symbol timestamp records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'symbolHashes',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.symbolDestination[0].timestamps - a.symbolDestination[0].timestamps);

			result.forEach((item, index) => {
				expect(item.symbolDestination[0].timestamps).to.be.equal(sortedResult[index].symbolDestination[0].timestamps);
			});
		});

		it('returns search result provided nem address', async () => {
			// Arrange:
			const nemAddressHex = '680B140819D8B6C734091637DA4B3B854BC2FD30D3FE42B0BA';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				nemAddressHex
			});

			// Assert:
			expect(result[0].nemSource.length).to.be.equal(1);
			expect(result[0].nemSource[0].address).to.be.equal(nemAddressHex);
		});

		it('returns search result provided symbol address', async () => {
			// Arrange:
			const symbolAddressHex = '6854E15A45E973283640A12F90001251695C2295F496871F';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				symbolAddressHex
			});

			// Assert:
			expect(result[0].symbolDestination.length).to.be.equal(1);
			expect(result[0].symbolDestination[0].address).to.be.equal(symbolAddressHex);
		});

		it('returns search result provided transaction hash', async () => {
			// Arrange:
			const txHash = 'D6E43A475D94C1338ED985E87EFE8FDB1FC498971FCB57A5DBEAB65EABE641B2';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				txHash
			});

			// Assert:
			expect(result[0].symbolDestination.length).to.be.equal(1);
			expect(result[0].symbolDestination[0].hashes).to.be.equal(txHash);
		});
	});

	describe('getTotalRecord', () => {
		runTotalRecordTests({
			database: completedDB,
			parameters: {
				nemAddressHex: null,
				optinType: null,
				symbolAddressHex: null,
				txHash: null
			},
			expectedResult: 20
		});
	});
});
