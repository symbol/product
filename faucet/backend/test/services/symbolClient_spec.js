import { config } from '../../src/config/index.js';
import createSymbolClient from '../../src/services/symbolClient.js';
import testConfigurationFactory from '../testConfigurationFactory.js';
import MockAdapter from 'axios-mock-adapter';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('symbol request', () => {
	let mock;
	const address = 'TDRWAPRUEP7DEVLYVCWDM6OD4RGCSMJMM43E7PQ';
	const faucetPublicKey = '54F65566363F0B6EC81E4D06B20401E468E762AB49923541631B485268E576C8';
	const baseUrl = 'http://localhost:3001';

	const symbolClient = createSymbolClient(config.symbol);

	beforeEach(() => {
		mock = new MockAdapter(symbolClient.axios);
	});

	afterEach(() => {
		mock.reset();
	});

	const runBasicErrorHandlerTests = (requestMethod, endpoint, method, params) => {
		it('server response code 500', async () => {
			// Arrange:
			mock[requestMethod](`${baseUrl}${endpoint}`).reply(() => [500, {
				message: 'internal server error'
			}]);

			// Act:
			const promise = params ? symbolClient[method](params) : symbolClient[method]();

			// Assert:
			await expect(promise).to.be.rejectedWith('internal server error');
		});

		it('fails request when network error', async () => {
			// Arrange:
			mock[requestMethod](`${baseUrl}${endpoint}`).networkError();

			// Act:
			const promise = params ? symbolClient[method](params) : symbolClient[method]();

			// Assert:
			await expect(promise).to.be.rejectedWith('unable to process request');
		});
	};

	describe('getAccountInfo', () => {
		it('returns account info when called /accounts endpoint with address provided', async () => {
			// Arrange:
			const accountInfo = testConfigurationFactory.createAccountInfo([{
				id: '72C0212E67A08BCE',
				amount: '999990950'
			}]);

			mock.onGet(`${baseUrl}/accounts/${address}`).reply(200, accountInfo);

			// Act:
			const { response } = await symbolClient.getAccountInfo(address);

			// Assert:
			expect(mock.history.get[0].url).to.equal(`/accounts/${address}`);
			expect(response.data).to.be.deep.equal(accountInfo);
		});

		it('returns error message when address not found in network', async () => {
			// Arrange:
			const newAddress = 'TBTJJMLVGFW25A2XWLQOJDNHZG6VITDPHHLUNQA';
			const notFoundResponse = {
				code: 'ResourceNotFound',
				message: 'no resource exists'
			};

			mock.onGet(`${baseUrl}/accounts/${newAddress}`).reply(404, notFoundResponse);

			// Act:
			const { response } = await symbolClient.getAccountInfo(newAddress);

			// Assert:
			expect(mock.history.get[0].url).to.equal(`/accounts/${newAddress}`);
			expect(response.data).to.be.deep.equal(notFoundResponse);
		});

		runBasicErrorHandlerTests('onGet', `/accounts/${address}`, 'getAccountInfo', address);
	});

	describe('getNetworkTime', () => {
		it('returns network time when called /node/time endpoint', async () => {
			// Arrange:
			const networkTime = {
				communicationTimestamps: {
					sendTimestamp: '8804535542',
					receiveTimestamp: '8804535542'
				}
			};

			mock.onGet(`${baseUrl}/node/time`).reply(200, networkTime);

			// Act:
			const { response } = await symbolClient.getNetworkTime();

			// Assert:
			expect(mock.history.get[0].url).to.equal('/node/time');
			expect(response.data).to.be.deep.equal(networkTime);
		});

		runBasicErrorHandlerTests('onGet', '/node/time', 'getNetworkTime');
	});

	describe('getNetworkProperties', () => {
		it('returns network properties when called /network/properties', async () => {
			// Arrange:
			const networkProperties = testConfigurationFactory.createNetworkProperties();

			mock.onGet(`${baseUrl}/network/properties`).reply(200, networkProperties);

			// Act:
			const { response } = await symbolClient.getNetworkProperties();

			// Assert:
			expect(mock.history.get[0].url).to.equal('/network/properties');
			expect(response.data).to.be.deep.equal(networkProperties);
		});

		runBasicErrorHandlerTests('onGet', '/network/properties', 'getNetworkProperties');
	});

	describe('getUnconfirmedTransferTransactions', () => {
		it('returns unconfirmed transfer transactions when called /account/unconfirmedTransactions with address provided', async () => {
			// Arrange:
			const unconfirmedTransferTransactions = testConfigurationFactory.createUnconfirmedTransferTransactions();

			mock.onGet(`${baseUrl}/transactions/unconfirmed?recipientAddress=${address}&signerPublicKey=${faucetPublicKey}&type=16724`)
				.reply(200, unconfirmedTransferTransactions);

			// Act:
			const { response } = await symbolClient.getUnconfirmedTransferTransactions(address);

			// Assert:
			expect(mock.history.get[0].url).to.equal(`/transactions/unconfirmed?recipientAddress=${address}`
			+ `&signerPublicKey=${faucetPublicKey}&type=16724`);
			expect(response.data).to.be.deep.equal(unconfirmedTransferTransactions);
		});

		runBasicErrorHandlerTests(
			'onGet',
			`/transactions/unconfirmed?recipientAddress=${address}&signerPublicKey=${faucetPublicKey}&type=16724`,
			'getUnconfirmedTransferTransactions', address
		);
	});

	describe('announceTransaction', () => {
		it('returns announce result when called /transactions endpoint', async () => {
			// Arrange:
			const announceResult = 'announce result';

			mock.onPut(`${baseUrl}/transactions`).reply(200, announceResult);

			// Act:
			const { response } = await symbolClient.announceTransaction('payload');

			// Assert:
			expect(mock.history.put[0].url).to.equal('/transactions');
			expect(response.data).to.be.deep.equal(announceResult);
		});

		runBasicErrorHandlerTests('onPut', '/transactions', 'announceTransaction', 'payload');
	});
});
