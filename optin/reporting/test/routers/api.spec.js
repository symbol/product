const CompletedDB = require('../../models/completed');
const OptinRequestsDB = require('../../models/optinRequests');
const app = require('../../server');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const request = require('supertest');

const runBasicRouteDataResponseTests = ({ path, queryParams }) => {
	it('should return records with pagination', async () => {
		// Act:
		const response = await request(app).get(path).query(queryParams);

		// Assert:
		expect(response.status).to.equal(200);
		expect(response.body.data.length).to.be.equal(10);
		expect(response.body.pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: 10 });
	});

	it('should return error required params not given', async () => {
		// Act:
		const response = await request(app).get(path);

		// Assert:
		expect(response.status).to.equal(422);
	});
};

const runBasicRouteDownloadCsvTests = ({ queryParams, path }) => {
	it('should return content-type in text/csv', async () => {
		// Act:
		const response = await request(app).get(path).query(queryParams);

		// Assert:
		expect(response.status).to.equal(200);
		expect(response.header['content-type']).to.equal('text/csv; charset=utf-8');
	});

	it('should return error timezone not given', async () => {
		// Act:
		const response = await request(app).get(path);

		// Assert:
		expect(response.status).to.equal(422);
	});
};

describe('API Route', () => {
	let getPaginationStub = {};
	let getTotalRecordStub = {};
	const numberOfRecords = 10;

	describe('completed', () => {
		beforeEach(() => {
			// Arrange:
			getPaginationStub = stub(CompletedDB, 'getCompletedPagination');
			getTotalRecordStub = stub(CompletedDB, 'getTotalRecord');

			const mockNemSources = [{
				address: '682FAFBA20454869F0278748FD9790CFFCE35E8722647B4039',
				balance: 79268194338335,
				hashes: 'CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190',
				height: 3004351,
				label: 'Bithumb',
				timestamps: '1609403596'
			}];

			const mockSymbolSources = [{
				address: '688ADC5D31F49F918AC71DCE18E7085944AEAB0AF60F8AD7',
				balance: 79268194338335,
				hashes: 'E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1',
				height: 1,
				timestamps: 1615853185
			}];

			const mockDb = TestUtils.mockCompletedDBRecord(numberOfRecords, mockNemSources, mockSymbolSources);

			getPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(numberOfRecords));
		});

		afterEach(() => {
			getPaginationStub = {};
			getTotalRecordStub = {};
			restore();
		});

		describe('GET api/completed', () => {
			// Arrange:
			const queryParams = {
				pageSize: 10, pageNumber: 1, optinType: '', nemAddress: '', symbolAddress: '', transactionHash: ''
			};

			it('should return empty records with pagination', async () => {
				// Arrange:
				const mockDbEmpty = [];

				getPaginationStub.returns(Promise.resolve(mockDbEmpty));
				getTotalRecordStub.returns(Promise.resolve(mockDbEmpty.length));

				// Act:
				const response = await request(app).get('/api/completed').query(queryParams);

				// Assert:
				expect(response.status).to.equal(200);
				expect(response.body.data.length).to.be.equal(0);
				expect(response.body.pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: 0 });
			});

			runBasicRouteDataResponseTests({
				path: '/api/completed',
				queryParams
			});
		});

		describe('GET api/completed/download', () => {
			runBasicRouteDownloadCsvTests({
				path: '/api/completed/download',
				queryParams: {
					timezone: 'America/Los_Angeles'
				}
			});
		});
	});

	describe('requests', () => {
		beforeEach(() => {
			// Arrange:
			getPaginationStub = stub(OptinRequestsDB, 'getOptinRequestPagination');
			getTotalRecordStub = stub(OptinRequestsDB, 'getTotalRecord');

			const mockDb = TestUtils.mockInProgressDBRecord(10);

			getPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(mockDb.length));
		});

		afterEach(() => {
			getPaginationStub = {};
			getTotalRecordStub = {};
			restore();
		});

		describe('GET api/requests', () => {
			// Arrange:
			const queryParams = {
				pageSize: 10, pageNumber: 1, nemAddressBytes: '', transactionHashBytes: '', status: ''
			};

			it('should return empty records with pagination', async () => {
				// Arrange:
				const mockDbEmpty = [];

				getPaginationStub.returns(Promise.resolve(mockDbEmpty));
				getTotalRecordStub.returns(Promise.resolve(mockDbEmpty.length));

				// Act:
				const response = await request(app).get('/api/requests').query(queryParams);

				// Assert:
				expect(response.status).to.equal(200);
				expect(response.body.data.length).to.be.equal(0);
				expect(response.body.pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: 0 });
			});

			runBasicRouteDataResponseTests({
				path: '/api/requests',
				queryParams
			});
		});

		describe('GET api/requests/download', () => {
			runBasicRouteDownloadCsvTests({
				path: '/api/requests/download',
				queryParams: {
					timezone: 'America/Los_Angeles'
				}
			});
		});
	});
});
