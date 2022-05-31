const Config = require('../../config');
const { refreshDBs } = require('../../models/database');
const optinRequestDB = require('../../models/optinRequests');
const runDBNotFoundTests = require('../test/runDBNotFoundTests');
const runTotalRecordTests = require('../test/runTotalRecordTests');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

const mockOptinRequestRecordQuery = {
	basic: [
		{
			optinTransactionHeight: 3613836,
			nemAddressBytes: Buffer.from('686b79b3711a31a54cc80480005756ce11070f81ab1d552d9f', 'hex'),
			optinTransactionHashHex: '41E2C3B5914BBB46988745646C0210CA9BDB02142F6E23172537D4C786AE838B',
			payoutTransactionHeight: '',
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'transaction optin message has unexpected type: 6',
			optinTimestamp: 1646288741,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3613836,
			nemAddressBytes: Buffer.from('686b79b3711a31a54cc80480005756ce11070f81ab1d552d9f', 'hex'),
			optinTransactionHashHex: '3A592E3055FBB047DC08F7A796EF5C510C2028EE9D471883C663802367CEBA3B',
			payoutTransactionHeight: '',
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'transaction optin message has unexpected type: 1',
			optinTimestamp: 1646288741,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3521693,
			nemAddressBytes: Buffer.from('6892ca14a71c94fc24bed9e27db73783d8af917d03542a8d61', 'hex'),
			optinTransactionHashHex: '4C62AF671783DB6CDC3F1CE86DB240E88CAD438FF2E1F1F79A3934441D4C4D7F',
			payoutTransactionHeight: 323744,
			payoutTransactionHash: '389687CDCD42896E4DB0597C002F04727D3FA2BB8D4A0BDA0ED33F4B93244E33',
			payoutStatus: 3,
			message: null,
			optinTimestamp: 1640713098,
			payoutTimestamp: 1625657230.024
		},
		{
			optinTransactionHeight: 3504684,
			nemAddressBytes: Buffer.from('68203b46032831e117c99fd1585c55df87d0d6a45439c4096e', 'hex'),
			optinTransactionHashHex: '60606C589C56401940E9BE9CAD86BFBF7C181C7F4A58D0D1D784D84B55BF859E',
			payoutTransactionHeight: null,
			payoutTransactionHash: '',
			payoutStatus: 3,
			message: 'optin completed',
			optinTimestamp: 1639685109,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3482862,
			nemAddressBytes: Buffer.from('68203b46032831e117c99fd1585c55df87d0d6a45439c4096e', 'hex'),
			optinTransactionHashHex: 'DEF4C5D1C700910ACDC7E42514100C76E44C9802C71B9D009BB1ABCC79AE9D33',
			payoutTransactionHeight: '',
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'destination is an invalid Symbol public key',
			optinTimestamp: 1638363779,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3440703,
			nemAddressBytes: Buffer.from('684d7251149ecec78dc31d8cc1d6c64f6ea67e4d5f993e73b5', 'hex'),
			optinTransactionHashHex: '6DF71501346162AACFCC4436AE3E2B765A2A0A9876741634E685892991A11445',
			payoutTransactionHeight: null,
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'account had zero balance at snapshot height',
			optinTimestamp: 1635802677,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3431676,
			nemAddressBytes: Buffer.from('68e75070dff989ce040849d9bfc02904720def65afd6146b1a', 'hex'),
			optinTransactionHashHex: '295FD7581A5A939EABB81E3DF067B1454E823D7F3AD184C311AFD52D9A2BDFB1',
			payoutTransactionHeight: null,
			payoutTransactionHash: '',
			payoutStatus: 3,
			message: 'optin completed',
			optinTimestamp: 1635256016,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3431396,
			nemAddressBytes: Buffer.from('68e75070dff989ce040849d9bfc02904720def65afd6146b1a', 'hex'),
			optinTransactionHashHex: '6620B71ACACE9DD9CDDAA6E358C0552D946638B896516409F30583171F061F51',
			payoutTransactionHeight: null,
			payoutTransactionHash: '',
			payoutStatus: 3,
			message: null,
			optinTimestamp: 1635239160,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3409589,
			nemAddressBytes: Buffer.from('685d8d00a0491d12faa04c0a865e3c36b85d01a12fe78c53b2', 'hex'),
			optinTransactionHashHex: 'DC981F781863843B3797BAF690BB0A5D7E99D20C3EAF5CDF09C367B47BF3524E',
			payoutTransactionHeight: '',
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'transaction has nonzero amount',
			optinTimestamp: 1633919864,
			payoutTimestamp: null
		},
		{
			optinTransactionHeight: 3384294,
			nemAddressBytes: Buffer.from('6831d7f86b134ea88031a15decfaf01b346ac48a3e782b140a', 'hex'),
			optinTransactionHashHex: '3D4B00B113911E9660D7517B8E56EE3295F6F8FD9FD2D77D2B9C93E7DC68A64A',
			payoutTransactionHeight: '',
			payoutTransactionHash: '',
			payoutStatus: 4,
			message: 'transaction message is not valid json',
			optinTimestamp: 1632389419,
			payoutTimestamp: null
		}
	]
};

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
			expect(result).to.deep.equal(mockOptinRequestRecordQuery.basic);
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
