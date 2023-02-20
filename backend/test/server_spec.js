import nemFacade from '../src/facade/nemFacade.js';
import symbolFacade from '../src/facade/symbolFacade.js';
import server from '../src/server.js';
import { expect } from 'chai';
import { stub, restore } from 'sinon';
import supertest from 'supertest';

describe('Server', () => {
	let transferStub = {};

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

	const createRequest = (url, body, authToken) => {
		const request = supertest(server)
			.post(url)
			.set('Accept', 'application/json')
			.send(body);

		if (authToken)
			request.set('authToken', authToken);

		return request;
	};

	const runBasicRouteTests = (protocolFacade, url, recipientAddress, invalidAddress, transactionHash) => {
		beforeEach(() => {
			const getAccountBalanceStub = stub(protocolFacade, 'getAccountBalance');

			getAccountBalanceStub
				.withArgs(protocolFacade.faucetAddress())
				.returns(Promise.resolve(10000000000));

			getAccountBalanceStub.returns(Promise.resolve(1000000));

			transferStub = stub(protocolFacade, 'transfer');

			stub(protocolFacade, 'getUnconfirmedTransactionsCount').returns(Promise.resolve(0));
		});

		afterEach(restore);

		it('responds 200', async () => {
			// Arrange:
			transferStub.returns(Promise.resolve(transactionHash));

			// Act:
			const response = await createRequest(url, {
				address: recipientAddress,
				amount: 10
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(200);
			expect(response.body).to.be.deep.equal({
				transactionHash,
				amount: 10,
				recipientAddress
			});
		});

		it('responds 400 given validation failure', async () => {
			// Arrange:
			const requestOverPayoutAmount = 100000;

			// Act:
			const response = await createRequest(url, {
				address: recipientAddress,
				amount: requestOverPayoutAmount
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(400);
			expect(response.body).to.be.deep.equal({
				code: 'BadRequest',
				message: 'error_fund_drains'
			});
		});

		it('responds 400 given invalid address', async () => {
			// Arrange + Act:
			const response = await createRequest(url, {
				address: invalidAddress,
				amount: 100
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(400);
			expect(response.body).to.be.deep.equal({
				code: 'BadRequest',
				message: 'error_address_invalid'
			});
		});

		it('responds 403 verify auth token fail', async () => {
			// Act:
			const response = await createRequest(url, {
				address: recipientAddress,
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
			const response = await createRequest(url, {
				address: recipientAddress,
				amount: 100
			}, twitterRequirementFailJwtToken);

			// Assert:
			expect(response.status).to.be.equal(403);
			expect(response.body).to.be.deep.equal({
				code: 'Forbidden',
				message: 'error_twitter_requirement_fail'
			});
		});
	};

	describe('POST /claim/xem', () =>
		runBasicRouteTests(
			nemFacade,
			'/claim/xem',
			'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
			'TBL6O45I3HL2J3X3LPRVCEAES3S6KTWLNZ76NDQ',
			'c1786437336da077cd572a27710c40c378610e8d33880bcb7bdb0a42e3d35586'
		));

	describe('POST /claim/xym', () =>
		runBasicRouteTests(
			symbolFacade,
			'/claim/xym',
			'TBL6O45I3HL2J3X3LPRVCEAES3S6KTWLNZ76NDQ',
			'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
			'C192657CCBFADFBBAACD059F54E122994E1D9B6DF449B9D12973D61CA7804D62'
		));

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
