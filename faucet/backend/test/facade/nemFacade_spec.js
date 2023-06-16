import nemFacade from '../../src/facade/nemFacade.js';
import { expect } from 'chai';
import { restore, stub } from 'sinon';

/**
 * Mock axios response.
 * @param {object} info data object.
 * @returns {object} axios response.
 */
const mockAxiosResponse = info => ({
	response: {
		data: info
	}
});

describe('nem facade', () => {
	const address = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';
	const absoluteAmount = 888000000;

	afterEach(restore);

	describe('isValidAddress', () => {
		it('should return true when Nem address provided', () => {
			// Arrange:
			const nemAddress = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';

			// Act:
			const result = nemFacade.isValidAddress(nemAddress);

			// Assert:
			expect(result).to.be.equal(true);
		});

		it('should return false when Symbol address provided', () => {
			// Arrange:
			const symbolAddress = 'TDRWAPRUEP7DEVLYVCWDM6OD4RGCSMJMM43E7PQ';

			// Act:
			const result = nemFacade.isValidAddress(symbolAddress);

			// Assert:
			expect(result).to.be.equal(false);
		});
	});

	describe('faucetAddress', () => {
		it('should return faucet address derived from the private key in the config', () => {
			// Act:
			const faucetAddress = nemFacade.faucetAddress();

			// Assert:
			expect(faucetAddress).to.be.equal('TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI');
		});
	});

	describe('transfer', () => {
		it('should return announce transaction hash', async () => {
			// Arrange:
			const mockNetworkTime = {
				sendTimeStamp: 219086039731,
				receiveTimeStamp: 219086039731
			};

			const mockAnnounceTransaction = {
				code: 1,
				type: 1,
				transactionHash: {
					data: '281efe730225471f5525cf0ace8b65fe6600db31e242fe9992abbf339588d1e7'
				}
			};

			const getNetworkTimeStub = stub(nemFacade.client, 'getNetworkTime');

			const announceTransactionStub = stub(nemFacade.client, 'announceTransaction');

			getNetworkTimeStub.returns(Promise.resolve(mockAxiosResponse(mockNetworkTime)));

			announceTransactionStub.returns(Promise.resolve(mockAxiosResponse(mockAnnounceTransaction)));

			// Act:
			const result = await nemFacade.transfer(absoluteAmount, address);

			// Assert:
			expect(result).to.be.equal(mockAnnounceTransaction.transactionHash.data);
		});
	});

	describe('getAccountBalance', () => {
		it('should return account balance given valid address', async () => {
			// Arrange:
			const mockAccountInfo = {
				meta: {
					cosignatories: [],
					cosignatoryOf: [],
					status: 'LOCKED',
					remoteStatus: 'INACTIVE'
				},
				account: {
					address,
					harvestedBlocks: 0,
					balance: absoluteAmount,
					importance: 0,
					vestedBalance: 354463104,
					publicKey: 'b6405c6d3e96228e8a57c7c84013600486dfd64a7bf14ed7c1daccfbd391f386',
					label: null,
					multisigInfo: {}
				}
			};

			const getAccountInfoStub = stub(nemFacade.client, 'getAccountInfo');

			getAccountInfoStub.returns(Promise.resolve(mockAxiosResponse(mockAccountInfo)));

			// Act:
			const accountBalance = await nemFacade.getAccountBalance(address);

			// Assert:
			expect(accountBalance).to.be.equal(absoluteAmount);
		});
	});

	describe('getUnconfirmedTransactionsCount', () => {
		it('should return no of unconfirmed transactions', async () => {
			// Arrange:
			const mockUnconfirmedTransactions = {
				data: [
					{
						meta: { data: null },
						transaction: {
							timeStamp: 219099085,
							amount: 10000000,
							signature: 'a17db3be6d24f5b4206acef9b7db699e5046b0be52c4767d12df5c50328ff713338172dbd1d290efa42725e636bbc1507e2016f3bdb618473dfd7637b0b3b30d', // eslint-disable-line max-len
							fee: 100000,
							recipient: address,
							type: 257,
							deadline: 219102685,
							message: { payload: '476f6f64204c75636b21', type: 1 },
							version: -1744830463,
							signer: 'b6405c6d3e96228e8a57c7c84013600486dfd64a7bf14ed7c1daccfbd391f386'
						}
					}
				]
			};

			stub(nemFacade.client, 'getUnconfirmedTransactions')
				.returns(Promise.resolve(mockAxiosResponse(mockUnconfirmedTransactions)));

			// Act:
			const unconfirmedTransactionsCount = await nemFacade.getUnconfirmedTransactionsCount(address);

			// Assert:
			expect(unconfirmedTransactionsCount).to.be.equal(1);
		});
	});

	describe('getNetworkTimestamp', () => {
		it('returns network timestamp', async () => {
			// Arrange:
			const networkTime = {
				sendTimeStamp: 219086039731,
				receiveTimeStamp: 219086039731
			};

			stub(nemFacade.client, 'getNetworkTime').returns(Promise.resolve(mockAxiosResponse(networkTime)));

			// Act:
			const timestamp = await nemFacade.getNetworkTimestamp();

			// Assert:
			expect(timestamp).to.be.equal(219086039);
		});
	});

	describe('config', () => {
		it('returns faucet config', () => {
			// Act:
			const config = nemFacade.config();

			// Assert:
			expect(config).to.deep.equal({
				faucetAddress: 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI',
				currency: 'XEM',
				sendOutMaxAmount: 500000000,
				mosaicDivisibility: 6,
				minFollowers: 10,
				minAccountAge: 30
			});
		});
	});
});
