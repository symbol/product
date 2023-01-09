import nemController from '../src/controllers/nem.js';
import server from '../src/server.js';
import { expect } from 'chai';
import { stub, restore } from 'sinon';
import supertest from 'supertest';

describe('Server', () => {
	describe('POST /claim/xem', () => {
		let getAccountBalanceStub = {};
		let getUnconfirmedTransactionsStub = [];
		let transferXemStub = {};
		let mockFaucetAccountBalance = {};
		let mockRequestAccountBalance = {};

		// decoded jwt payload
		// {
		// 	"accessToken": "token1234",
		// 	"accessSecret": "secret1234",
		// 	"screenName": "twitterAccount",
		// 	"followersCount": 15,
		// 	"createdAt": "2022-10-15T00:00:00.000Z",
		// }
		const validJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
			+ 'eyJhY2Nlc3NUb2tlbiI6InRva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6InNlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY29'
			+ '1bnQiLCJmb2xsb3dlcnNDb3VudCI6MTUsImNyZWF0ZWRBdCI6IjIwMjItMTAtMTVUMDA6MDA6MDAuMDAwWiIsImlhdCI6MTY3MTEwMTI0MH0.'
			+ 'tffb1g17SetxmC5cPuQ8nZrrUzRf_nBlcA_ydKUUv6U';

		beforeEach(() => {
			getAccountBalanceStub = stub(nemController, 'getAccountBalance');
			getUnconfirmedTransactionsStub = stub(nemController, 'getUnconfirmedTransactions');
			transferXemStub = stub(nemController, 'transferXem');

			mockFaucetAccountBalance = {
				address: 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI',
				balance: 10000000000
			};

			mockRequestAccountBalance = {
				address: 'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
				balance: 1000000
			};

			getAccountBalanceStub
				.withArgs(mockFaucetAccountBalance.address)
				.returns(Promise.resolve(mockFaucetAccountBalance));

			getUnconfirmedTransactionsStub.returns(Promise.resolve([]));

			getAccountBalanceStub.returns(Promise.resolve(mockRequestAccountBalance));
		});

		afterEach(restore);

		const createRequest = (body, authToken) => {
			const request = supertest(server)
				.post('/claim/xem')
				.set('Accept', 'application/json')
				.send(body);

			if (authToken)
				request.set('authToken', authToken);

			return request;
		};

		it('responds 200', async () => {
			// Arrange:
			const mockTransferXemResult = {
				code: 1,
				type: 1,
				transactionHash: {
					data: 'c1786437336da077cd572a27710c40c378610e8d33880bcb7bdb0a42e3d35586'
				}
			};

			transferXemStub.returns(Promise.resolve(mockTransferXemResult));

			// Act:
			const response = await createRequest({
				address: mockRequestAccountBalance.address,
				amount: 10
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(200);
			expect(response.body).to.be.deep.equal({
				code: 1,
				type: 1,
				transactionHash: mockTransferXemResult.transactionHash.data,
				amount: 10,
				receiptAddress: mockRequestAccountBalance.address
			});
		});

		it('responds 400 given validation failure', async () => {
			// Arrange:
			const requestOverPayoutAmount = 100000;

			// Act:
			const response = await createRequest({
				address: mockRequestAccountBalance.address,
				amount: requestOverPayoutAmount
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(400);
			expect(response.body).to.be.deep.equal({
				code: 'BadRequest',
				message: 'error_fund_drains'
			});
		});

		it('responds 403 verify auth token fail', async () => {
			// Act:
			const response = await createRequest({
				address: mockRequestAccountBalance.address,
				amount: 100
			}, 'invalidToken');

			// Assert:
			expect(response.status).to.be.equal(403);
			expect(response.body).to.be.deep.equal({
				code: 'Forbidden',
				message: 'error_authentication_fail'
			});
		});

		it('responds 403 twitter requirement fail', async () => {
			// Arrange:

			// decoded jwt payload
			// {
			// 	"accessToken": "token1234",
			// 	"accessSecret": "secret1234",
			// 	"screenName": "twitterAccount",
			// 	"followersCount": 3,  <--- min followers count must 10 or above
			// 	"createdAt": "2022-10-15T00:00:00.000Z",
			// }
			const twitterRequirementFailJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
			+ 'eyJhY2Nlc3NUb2tlbiI6InRva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6InNlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY29'
			+ '1bnQiLCJmb2xsb3dlcnNDb3VudCI6MywiY3JlYXRlZEF0IjoiMjAyMi0xMC0xNVQwMDowMDowMC4wMDBaIiwiaWF0IjoxNjcwOTcyMjQyfQ.'
			+ '8r2MZNX7QEyG3t4lhqPFedOrzweJyY78mK9mYYd5O1g';

			// Act:
			const response = await createRequest({
				address: mockRequestAccountBalance.address,
				amount: 100
			}, twitterRequirementFailJwtToken);

			// Assert:
			expect(response.status).to.be.equal(403);
			expect(response.body).to.be.deep.equal({
				code: 'Forbidden',
				message: 'error_twitter_requirement_fail'
			});
		});

		it('responds 500 given invalid address', async () => {
			// Arrange + Act:
			const response = await createRequest({
				address: 'abc',
				amount: 100
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(500);
		});
	});

	describe('OPTIONS /claim/xem', () => {
		it('responds 204 when preflight request', async () => {
			// Act:
			const response = await supertest(server)
				.options('/claim/xem');

			// Assert:
			expect(response.status).to.be.equal(204);
			expect(response.headers['access-control-allow-origin']).to.be.equal('*');
			expect(response.headers['access-control-allow-methods']).to.be.equal('POST, OPTIONS');
			expect(response.headers['access-control-allow-headers']).to.be.equal('Content-Type, authToken');
		});
	});
});
