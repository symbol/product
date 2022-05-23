const CompletedDB = require('../../models/completed');
const OptinRequestsDB = require('../../models/optinRequests');
const app = require('../../server');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const request = require('supertest');

const runBasicRouteDataResponseTests = ({
	path, queryParams, model, mockPaginationMethod, mockDb
}) => {
	let paginationStub = {};
	let totalRecordStub = {};

	beforeEach(() => {
		paginationStub = stub(model, mockPaginationMethod);
		totalRecordStub = stub(model, 'getTotalRecord');
	});

	afterEach(() => {
		restore();
	});

	it('returns empty records with pagination', async () => {
		// Arrange:
		const mockDbEmpty = [];

		paginationStub.returns(Promise.resolve(mockDbEmpty));
		totalRecordStub.returns(Promise.resolve(mockDbEmpty.length));

		// Act:
		const response = await request(app).get(path).query(queryParams);

		// Assert:
		expect(response.status).to.equal(200);
		expect(response.body.data.length).to.be.equal(0);
		expect(response.body.pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: 0 });
	});

	it('returns records with pagination', async () => {
		// Arrange:
		paginationStub.returns(Promise.resolve(mockDb));
		totalRecordStub.returns(Promise.resolve(mockDb.length));

		// Act:
		const response = await request(app).get(path).query(queryParams);

		// Assert:
		expect(response.status).to.equal(200);
		expect(response.body.data.length).to.be.equal(10);
		expect(response.body.pagination).to.be.eql({ pageSize: 10, pageNumber: 1, totalRecord: 10 });
	});

	it('returns error required params not given', async () => {
		// Act:
		const response = await request(app).get(path);

		// Assert:
		expect(response.status).to.equal(422);
	});
};

const runBasicRouteDownloadCsvTests = ({
	queryParams, path, model, mockPaginationMethod
}) => {
	it('returns content-type in text/csv', async () => {
		// Arrange:
		const paginationStub = stub(model, mockPaginationMethod);
		paginationStub.returns(Promise.resolve([]));

		// Act:
		const response = await request(app).get(path).query(queryParams);

		// Assert:
		expect(response.status).to.equal(200);
		expect(response.header['content-type']).to.equal('text/csv; charset=utf-8');
	});

	it('returns error timezone not given', async () => {
		// Act:
		const response = await request(app).get(path);

		// Assert:
		expect(response.status).to.equal(422);
	});
};

describe('API Route', () => {
	describe('completed', () => {
		// Arrange:
		const completedStub = {
			model: CompletedDB,
			mockPaginationMethod: 'getCompletedPagination'
		};

		describe('GET api/completed', () => {
			// Arrange:
			const queryParams = {
				pageSize: 10, pageNumber: 1, optinType: '', nemAddress: '', symbolAddress: '', transactionHash: ''
			};

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

			const mockDb = TestUtils.mockCompletedDBRecord(10, mockNemSources, mockSymbolSources);

			runBasicRouteDataResponseTests({
				path: '/api/completed',
				queryParams,
				mockDb,
				...completedStub
			});
		});

		describe('GET api/completed/download', () => {
			runBasicRouteDownloadCsvTests({
				path: '/api/completed/download',
				queryParams: {
					timezone: 'America/Los_Angeles'
				},
				...completedStub
			});
		});
	});

	describe('requests', () => {
		// Arrange:
		const optinRequestStub = {
			model: OptinRequestsDB,
			mockPaginationMethod: 'getOptinRequestPagination'
		};

		describe('GET api/requests', () => {
			// Arrange:
			const queryParams = {
				pageSize: 10, pageNumber: 1, nemAddressBytes: '', transactionHashBytes: '', status: ''
			};

			const mockDb = TestUtils.mockInProgressDBRecord(10);

			runBasicRouteDataResponseTests({
				path: '/api/requests',
				queryParams,
				mockDb,
				...optinRequestStub
			});
		});

		describe('GET api/requests/download', () => {
			runBasicRouteDownloadCsvTests({
				path: '/api/requests/download',
				queryParams: {
					timezone: 'America/Los_Angeles'
				},
				...optinRequestStub
			});
		});
	});

	describe('wildcard route', () => {
		// Arrange:
		const randomPath = ['/test', '/api/completed/random', '/api/requests/random'];

		it('returns html index page', async () => {
			/* eslint-disable no-await-in-loop */
			for (let i = 0; i <= randomPath.length - 1; ++i) {
				// Act:
				const response = await request(app).get(randomPath[i]);

				// Assert:
				expect(response.status).to.equal(200);
				expect(response.type).to.equal('text/html');
			}
		});
	});
});
