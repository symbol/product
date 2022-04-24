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

	beforeEach(() => {
		getOptinRequestPaginationStub = stub(OptinRequestsDB, 'getOptinRequestPagination');
		getTotalRecordStub = stub(OptinRequestsDB, 'getTotalRecord');
		req = TestUtils.mockRequest({
			pageSize: 10, pageNumber: 1, nemAddressBytes: '', transactionHashBytes: '', status: ''
		});
		res = TestUtils.mockResponse();
	});

	afterEach(() => {
		req = {};
		res = {};
		restore();
	});

	describe('getOptinRequestPagination', () => {
		it('should return basic data', async () => {
			// Arrange:
			const recordSize = 10;
			const mockDb = TestUtils.mockInProgressDBRecord(10);

			getOptinRequestPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(recordSize));

			// Act:
			await OptinRequestsController.getOptinRequests(req, res);

			// Assert:
			const { pagination, data } = res.json.getCall(0).firstArg;
			const result = data[0];

			expect(pagination).to.be.eql({ pageSize: recordSize, pageNumber: 1, totalRecord: recordSize });
			expect(data.length).to.be.equal(10);

			expect(result.optinTransactionHeight).to.have.equal(mockDb[0].optinTransactionHeight);
			expect(result.nemAddress).to.have.equal('NAOF6GII33DLOK6CBR6SHL6IU6GKVDZHBHVVYRFG');
			expect(result.optinTransactionHash).to.have.equal(mockDb[0].optinTransactionHashHex.toLowerCase());
			expect(result.payoutTransactionHeight).to.have.equal(mockDb[0].payoutTransactionHeight);
			expect(result.payoutTransactionHash).to.have.equal(mockDb[0].payoutTransactionHash.toLowerCase());
			expect(result.status).to.have.equal('Sent');
			expect(result.message).to.have.equal(mockDb[0].message);
			expect(result.optinTimestamp).to.have.equal(mockDb[0].optinTimestamp);
			expect(result.payoutTimestamp).to.have.equal(mockDb[0].payoutTimestamp);
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

		it('should return csv data', async () => {
			// Assert:
			const result = res.send.getCall(0).firstArg;
			const csv = result.split('\n');

			expect(csv[0]).to.be.equal('"Nem Address","Opt-in Hash","Opt-in Height","Timestamp","Timestamp [UTC]","Payout Hash","Payout Height","Timestamp","Timestamp [UTC]","Status","Message"'); // eslint-disable-line
			expect(csv[1]).to.be.equal('"NAOF6GII33DLOK6CBR6SHL6IU6GKVDZHBHVVYRFG","f5d493494dcacf5fae2f1aea02165c8892699bb9879075f9d0ad63ac4b00491f",1,"22-04-15 15:46:54","22-04-15 15:46:54","4ac160a12835aa3f313676173386ed4f1ac6f840bdf1ea039725fc1b31b47b8b",1,"22-04-19 20:18:35","22-04-19 20:18:35","Sent",'); // eslint-disable-line
		});

		it('should return test/csv in response header content type', async () => {
			// Assert:
			const result = res.header.getCall(0).lastArg;
			expect(result).to.be.equal('text/csv');
		});

		it('should return name in response attachment', async () => {
			// Assert:
			const result = res.attachment.getCall(0).firstArg;
			expect(result).to.be.eql('request.csv');
		});
	});
});
