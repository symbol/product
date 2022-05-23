const OptinRequestsController = require('../../controllers/optinRequestsController');
const OptinRequestsDB = require('../../models/optinRequests');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');

describe('optin requests controller', () => {
	let getOptinRequestPaginationStub = {};
	let getTotalRecordStub = {};
	let req = {};
	let res = {};
	const parameter = {
		pageSize: 10,
		pageNumber: 1,
		nemAddress: '',
		transactionHash: '',
		status: '',
		sortBy: '',
		sortDirection: ''
	};

	beforeEach(() => {
		getOptinRequestPaginationStub = stub(OptinRequestsDB, 'getOptinRequestPagination');
		getTotalRecordStub = stub(OptinRequestsDB, 'getTotalRecord');
		req = TestUtils.mockRequest(parameter);
		res = TestUtils.mockResponse();
	});

	afterEach(() => {
		req = {};
		res = {};
		restore();
	});

	describe('getOptinRequestPagination', () => {
		const runBasicOptinRequestStatusTests = (status, index) => {
			it(`returns data with ${status} status`, async () => {
				// Arrange:
				const mockDb = TestUtils.mockInProgressDBRecord(1, index);

				req = TestUtils.mockRequest({
					...parameter,
					status
				});

				getOptinRequestPaginationStub.returns(Promise.resolve(mockDb));
				getTotalRecordStub.returns(Promise.resolve(1));

				// Act:
				await OptinRequestsController.getOptinRequests(req, res);

				// Assert:
				const { data } = res.json.getCall(0).firstArg;
				const result = data[0];

				expect(result.status).to.have.equal(status);
			});
		};

		const runBasicDataResponseTests = async (recordSize, expectResult) => {
			// Arrange:
			const mockDb = TestUtils.mockInProgressDBRecord(recordSize);

			getOptinRequestPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(recordSize));

			// Act:
			await OptinRequestsController.getOptinRequests(req, res);

			// Assert:
			const { pagination, data } = res.json.getCall(0).firstArg;
			const result = data[0];

			expect(pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: recordSize });

			expect(result.optinTransactionHeight).to.have.equal(expectResult[0].optinTransactionHeight);
			expect(result.nemAddress).to.have.equal('NAOF6GII33DLOK6CBR6SHL6IU6GKVDZHBHVVYRFG');
			expect(result.optinTransactionHash).to.have.equal(expectResult[0].optinTransactionHashHex.toLowerCase());
			expect(result.payoutTransactionHeight).to.have.equal(expectResult[0].payoutTransactionHeight);
			expect(result.payoutTransactionHash).to.have.equal(expectResult[0].payoutTransactionHash.toLowerCase());
			expect(result.status).to.have.equal('Pending');
			expect(result.message).to.have.equal(expectResult[0].message);
			expect(result.optinTimestamp).to.have.equal(expectResult[0].optinTimestamp);
			expect(result.payoutTimestamp).to.have.equal(expectResult[0].payoutTimestamp);
		};

		it('returns basic data', async () => {
			// Arrange:
			const recordSize = 10;
			const mockDb = TestUtils.mockInProgressDBRecord(10);

			await runBasicDataResponseTests(recordSize, mockDb);
		});

		it('returns filtered nemAddress', async () => {
			// Arrange:
			const recordSize = 10;
			const mockDb = TestUtils.mockInProgressDBRecord(1);

			req = TestUtils.mockRequest({
				...parameter,
				nemAddress: 'naof6gii33dlok6cbr6shl6iu6gkvdzhbhvvyrfg'
			});

			await runBasicDataResponseTests(recordSize, mockDb);
		});

		it('returns filtered transactionHash', async () => {
			// Arrange:
			const recordSize = 10;
			const mockDb = TestUtils.mockInProgressDBRecord(1);

			req = TestUtils.mockRequest({
				...parameter,
				transactionHash: 'f5d493494dcacf5fae2f1aea02165c8892699bb9879075f9d0ad63ac4b00491f'
			});

			await runBasicDataResponseTests(recordSize, mockDb);
		});

		describe('optin request status', () => {
			// Arrange:
			const status = ['Pending', 'Sent', 'Duplicate', 'Error', 'Unknown'];
			const statusCode = [0, 1, 3, 4, 5];

			for (let i = 0; i <= status.length - 1; ++i)
				runBasicOptinRequestStatusTests(status[i], statusCode[i]);
		});

		it('throw error', async () => {
			// Arrange:
			getOptinRequestPaginationStub.throws(new Error('database error'));

			// Act:
			await OptinRequestsController.getOptinRequests(req, res);

			// Assert:
			const { data, error } = res.json.getCall(0).firstArg;

			expect(data).to.be.eql([]);
			expect(error).to.be.equal('database error');
		});
	});

	describe('exportCsv', async () => {
		beforeEach(async () => {
			// Arrange:
			const mockDb = TestUtils.mockInProgressDBRecord(1);

			getOptinRequestPaginationStub.returns(Promise.resolve(mockDb));

			// Act:
			await OptinRequestsController.exportCsv(req, res);
		});

		it('returns csv data', async () => {
			// Assert:
			const result = res.send.getCall(0).firstArg;
			const csv = result.split('\n');

			expect(csv[0]).to.be.equal('"Nem Address","Opt-in Hash","Opt-in Height","Timestamp","Timestamp [UTC]","Payout Hash","Payout Height","Timestamp","Timestamp [UTC]","Status","Message"'); // eslint-disable-line
			expect(csv[1]).to.be.equal('"NAOF6GII33DLOK6CBR6SHL6IU6GKVDZHBHVVYRFG","f5d493494dcacf5fae2f1aea02165c8892699bb9879075f9d0ad63ac4b00491f",1,"22-04-15 15:46:54","22-04-15 15:46:54","4ac160a12835aa3f313676173386ed4f1ac6f840bdf1ea039725fc1b31b47b8b",1,"22-04-19 20:18:35","22-04-19 20:18:35","Pending",'); // eslint-disable-line
		});

		it('returns test/csv in response header content type', async () => {
			// Arrange + Act:
			const result = res.header.getCall(0).lastArg;

			// Assert:
			expect(result).to.be.equal('text/csv');
		});

		it('returns name in response attachment', async () => {
			// Arrange + Act:
			const result = res.attachment.getCall(0).firstArg;

			// Assert:
			expect(result).to.be.eql('request.csv');
		});
	});
});
