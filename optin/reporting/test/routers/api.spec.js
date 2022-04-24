const CompletedDB = require('../../models/completed');
const OptinRequestsDB = require('../../models/optinRequests');
const app = require('../../server');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const request = require('supertest');

const runBasicRouteDownloadCsvTests = response => {
	it('should return content-type in text/csv', () => {
		// Assert:
		expect(response.header['content-type']).to.equal('text/csv; charset=utf-8');
		expect(response.status).to.equal(200);
	});
};

const runBasicRouteDataResponseTests = response => {
	it('should return content-type in text/csv', () => {
		// Assert:
		expect(response.body).to.have.property('data');
		expect(response.body).to.have.property('pagination');
		expect(response.status).to.equal(200);
	});
};

describe('API Route', () => {
	describe('completed', () => {
		beforeEach(() => {
			// Arrange:
			const getCompletedPaginationStub = stub(CompletedDB, 'getCompletedPagination');
			const getTotalRecordStub = stub(CompletedDB, 'getTotalRecord');

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

			const mockDb = TestUtils.mockCompletedDBRecord(1, mockNemSources, mockSymbolSources);

			getCompletedPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(1));
		});

		afterEach(() => {
			restore();
		});

		describe('GET api/completed', () => {
			it('should return a row data', async () => {
				// Act:
				const response = await request(app).get('/api/completed').query({
					pageSize: 1, pageNumber: 1, optinType: 0, nemAddress: '', symbolAddress: '', transactionHash: ''
				});

				runBasicRouteDataResponseTests(response);
			});
		});

		describe('GET api/completed/download', () => {
			it('should return content-type in text/csv', async () => {
				// Act:
				const response = await request(app).get('/api/completed/download');

				runBasicRouteDownloadCsvTests(response);
			});
		});
	});

	describe('requests', () => {
		beforeEach(() => {
			// Arrange:
			const getOptinRequestPaginationStub = stub(OptinRequestsDB, 'getOptinRequestPagination');
			const getTotalRecordStub = stub(OptinRequestsDB, 'getTotalRecord');

			const mockDb = TestUtils.mockInProgressDBRecord(1);

			getOptinRequestPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(1));
		});

		afterEach(() => {
			restore();
		});

		describe('GET api/requests', () => {
			it('should return a row data', async () => {
				// Act:
				const response = await request(app).get('/api/requests').query({
					pageSize: 1, pageNumber: 1, nemAddressBytes: '', transactionHashBytes: '', status: ''
				});

				runBasicRouteDataResponseTests(response);
			});
		});

		describe('GET api/requests/download', () => {
			it('should return content-type in text/csv', async () => {
				// Act:
				const response = await request(app).get('/api/requests/download');

				runBasicRouteDownloadCsvTests(response);
			});
		});
	});
});
