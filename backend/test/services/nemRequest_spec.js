const nemRequest = require('../../src/services/nemRequest');
const axiosRequest = require('../../src/utils/axiosRequest');
const MockAdapter = require('axios-mock-adapter');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { expect } = chai;

describe('nem request', () => {
	let mock;

	beforeEach(() => {
		mock = new MockAdapter(axiosRequest);
	});

	afterEach(() => {
		mock.reset();
	});

	const address = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';
	const baseUrl = 'http://localhost:7890';

	const runBasicErrorHandlerTests = (requestMethod, endpoint, method, params) => {
		it('server response code 500', async () => {
			// Arrange:
			mock[requestMethod](`${baseUrl}${endpoint}`).reply(() => [500, {
				message: 'internal server error'
			}]);

			// Act:
			const promise = params ? nemRequest[method](params) : nemRequest[method]();

			// Assert:
			await expect(promise).to.be.rejectedWith('internal server error');
		});

		it('fails request when network error', async () => {
			// Arrange:
			mock[requestMethod](`${baseUrl}${endpoint}`).networkError();

			// Act:
			const promise = params ? nemRequest[method](params) : nemRequest[method]();

			// Assert:
			await expect(promise).to.be.rejectedWith('unable to process request');
		});
	};

	describe('getAccountInfo', () => {
		it('returns account info when called /account/get endpoint with address provided', async () => {
			// Arrange:
			const accountInfo = {
				meta: {
					cosignatories: [],
					cosignatoryOf: [],
					status: 'LOCKED',
					remoteStatus: 'INACTIVE'
				},
				account: {
					address,
					harvestedBlocks: 0,
					balance: 1000,
					importance: 0,
					vestedBalance: 354463104,
					publicKey: 'b6405c6d3e96228e8a57c7c84013600486dfd64a7bf14ed7c1daccfbd391f386',
					label: null,
					multisigInfo: {}
				}
			};

			mock.onGet(`${baseUrl}/account/get?address=${address}`).reply(200, accountInfo);

			// Act:
			const { response } = await nemRequest.getAccountInfo(address);

			// Assert:
			expect(mock.history.get[0].url).to.equal(`/account/get?address=${address}`);
			expect(response.data).to.be.deep.equal(accountInfo);
		});

		runBasicErrorHandlerTests('onGet', `/account/get?address=${address}`, 'getAccountInfo', address);
	});

	describe('getNetworkTime', () => {
		it('returns network time when called /time-sync/network-time endpoint', async () => {
			// Arrange:
			const networkTime = {
				sendTimeStamp: 219086039731,
				receiveTimeStamp: 219086039731
			};

			mock.onGet(`${baseUrl}/time-sync/network-time`).reply(200, networkTime);

			// Act:
			const { response } = await nemRequest.getNetworkTime();

			// Assert:
			expect(mock.history.get[0].url).to.equal('/time-sync/network-time');
			expect(response.data).to.be.deep.equal(networkTime);
		});

		runBasicErrorHandlerTests('onGet', '/time-sync/network-time', 'getNetworkTime');
	});

	describe('getUnconfirmedTransactions', () => {
		it('returns unconfirmed transactions when called /account/unconfirmedTransactions endpoint with address provided', async () => {
			// Arrange:
			const unconfirmedTransactions = {
				data: [
					{
						meta: { data: null },
						transaction: {
							timeStamp: 219099085,
							amount: 10000000,
							signature: 'a17db3be6d24f5b4206acef9b7db699e5046b0be52c4767d12df5c50328ff713338172dbd1d290efa42725e636bbc1507e2016f3bdb618473dfd7637b0b3b30d', // eslint-disable-line max-len
							fee: 100000,
							recipient: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
							type: 257,
							deadline: 219102685,
							message: { payload: '476f6f64204c75636b21', type: 1 },
							version: -1744830463,
							signer: 'b6405c6d3e96228e8a57c7c84013600486dfd64a7bf14ed7c1daccfbd391f386'
						}
					}
				]
			};

			mock.onGet(`${baseUrl}/account/unconfirmedTransactions?address=${address}`).reply(200, unconfirmedTransactions);

			// Act:
			const { response } = await nemRequest.getUnconfirmedTransactions(address);

			// Assert:
			expect(mock.history.get[0].url).to.equal(`/account/unconfirmedTransactions?address=${address}`);
			expect(response.data).to.be.deep.equal(unconfirmedTransactions);
		});

		runBasicErrorHandlerTests('onGet', `/account/unconfirmedTransactions?address=${address}`, 'getUnconfirmedTransactions', address);
	});

	describe('announceTransaction', () => {
		it('returns announce result when called /transaction/announce endpoint', async () => {
			// Arrange:
			const announceTransaction = {
				code: 1,
				type: 1,
				message: 'SUCCESS',
				transactionHash: {
					data: '281efe730225471f5525cf0ace8b65fe6600db31e242fe9992abbf339588d1e7'
				},
				innerTransactionHash: null
			};

			mock.onPost(`${baseUrl}/transaction/announce`).reply(200, announceTransaction);

			// Act:
			const { response } = await nemRequest.announceTransaction({
				payload: 'payload'
			});

			// Assert:
			expect(mock.history.post[0].url).to.equal('/transaction/announce');
			expect(response.data).to.be.deep.equal(announceTransaction);
		});

		runBasicErrorHandlerTests('onPost', '/transaction/announce', 'announceTransaction', {
			payload: 'payload'
		});
	});
});
