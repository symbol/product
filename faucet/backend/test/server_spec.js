import testHelper from './testHelper.js';
import ClaimDatabase from '../src/database/ClaimDatabase.js';
import DatabaseConnection from '../src/database/DatabaseConnection.js';
import nemFacade from '../src/facade/nemFacade.js';
import symbolFacade from '../src/facade/symbolFacade.js';
import createRestifyServer from '../src/server.js';
import { expect } from 'chai';
import { restore, stub } from 'sinon';
import supertest from 'supertest';

describe('Server', () => {
	let transferStub = {};
	let claimDatabase = {};
	let server = {};

	beforeEach(() => {
		const { connection } = new DatabaseConnection(':memory:');
		claimDatabase = new ClaimDatabase(connection);

		claimDatabase.createTable();

		server = createRestifyServer(claimDatabase);
	});

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

	const runBasicClaimRouteTests = (protocolFacade, protocolName, url, recipientAddress, invalidAddress, transactionHash) => {
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

		const assertInputAmount = async (amount, expectedResult) => {
			// Arrange:
			transferStub.returns(Promise.resolve(transactionHash));

			// Act:
			const response = await createRequest(url, {
				address: recipientAddress,
				amount,
				twitterHandle: '@username'
			}, validJwtToken);

			// Assert:
			expect(response.status).to.be.equal(200);
			expect(response.body).to.be.deep.equal({
				transactionHash,
				amount: expectedResult,
				recipientAddress
			});
		};

		const assertRecordInserted = async amount => {
			// Assert:
			const result = await testHelper.readDB(claimDatabase.connection, 'all', 'SELECT * FROM claimed');

			expect(result.length).to.be.equal(1);
			expect(result[0]).to.deep.include({
				id: 1,
				twitter_handle: '@username',
				protocol: protocolName,
				address: recipientAddress,
				amount
			});

			// The timestamp is not exactly the same, so we check if it is close to the current time
			expect(new Date(result[0].claimed_at).getTime()).to.be.closeTo(new Date().getTime(), 2000);
		};

		const assertRecordNotInserted = async () => {
			// Assert:
			const result = await testHelper.readDB(claimDatabase.connection, 'all', 'SELECT * FROM claimed');

			expect(result.length).to.be.equal(0);
		};

		it('responds 200 given integer amount', async () => {
			await assertInputAmount(10, 10);
			await assertRecordInserted(10000000, protocolName);
		});

		it('responds 200 given amount decimal', async () => {
			await assertInputAmount(10.123456, 10.123456);
			await assertRecordInserted(10123456, protocolName);
		});

		it('responds 200 given amount 7 decimal places and returns max 6 decimal places', async () => {
			await assertInputAmount(10.1234567, 10.123457);
			await assertRecordInserted(10123457, protocolName);
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

			await assertRecordNotInserted();
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

			await assertRecordNotInserted();
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

			await assertRecordNotInserted();
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

			await assertRecordNotInserted();
		});
	};

	describe('POST /claim/xem', () =>
		runBasicClaimRouteTests(
			nemFacade,
			'NEM',
			'/claim/xem',
			'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
			'TBL6O45I3HL2J3X3LPRVCEAES3S6KTWLNZ76NDQ',
			'c1786437336da077cd572a27710c40c378610e8d33880bcb7bdb0a42e3d35586'
		));

	describe('POST /claim/xym', () =>
		runBasicClaimRouteTests(
			symbolFacade,
			'Symbol',
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

	const runBasicConfigRouteTests = (protocolFacade, url, expectedResult) => {
		beforeEach(() => {
			const getAccountBalanceStub = stub(protocolFacade, 'getAccountBalance');
			getAccountBalanceStub
				.withArgs(protocolFacade.faucetAddress())
				.returns(Promise.resolve(10000000000));

			getAccountBalanceStub.returns(Promise.resolve(1000000));
		});

		afterEach(restore);

		it('responds 200 with config and faucet balance', async () => {
			// Act:
			const response = await supertest(server).get(url);

			// Assert:
			expect(response.status).to.be.equal(200);
			expect(response.body).to.deep.equal({
				sendOutMaxAmount: 500000000,
				mosaicDivisibility: 6,
				minFollowers: 10,
				minAccountAge: 30,
				faucetBalance: 10000000000,
				...expectedResult
			});
		});
	};

	describe('GET /config/xem', () => runBasicConfigRouteTests(nemFacade, '/config/xem', {
		faucetAddress: 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI',
		currency: 'XEM'
	}));

	describe('GET /config/xym', () => runBasicConfigRouteTests(symbolFacade, '/config/xym', {
		faucetAddress: 'TDABFEGKRADYE3ETIMDPKLMNVZ22OU7XADOOHSY',
		currency: 'XYM'
	}));
});
