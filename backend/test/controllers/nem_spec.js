const nemController = require('../../src/controllers/nem');
const nemRequest = require('../../src/services/nemRequest');
const { expect } = require('chai');
const { stub } = require('sinon');

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

describe('nem controller', () => {
	const address = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';
	const absoluteAmount = 888000000;

	describe('transferXem', () => {
		it('should return announce transaction result', async () => {
			// Arrange:
			const mockNetworkTime = {
				sendTimeStamp: 219086039731,
				receiveTimeStamp: 219086039731
			};

			const mockAnnounceTransaction = {
				code: 1,
				type: 1,
				transactionHash: '281efe730225471f5525cf0ace8b65fe6600db31e242fe9992abbf339588d1e7',
				amount: absoluteAmount,
				receiptAddress: address
			};

			const getNetworkTimeStub = stub(nemRequest, 'getNetworkTime');

			const announceTransactionStub = stub(nemRequest, 'announceTransaction');

			getNetworkTimeStub.returns(Promise.resolve(mockAxiosResponse(mockNetworkTime)));

			announceTransactionStub.returns(Promise.resolve(mockAxiosResponse(mockAnnounceTransaction)));

			// Act:
			const result = await nemController.transferXem(absoluteAmount, address);

			// Assert:
			expect(result).to.be.deep.equal(mockAnnounceTransaction);
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

			const getAccountInfoStub = stub(nemRequest, 'getAccountInfo');

			getAccountInfoStub.returns(Promise.resolve(mockAxiosResponse(mockAccountInfo)));

			// Act:
			const accountBalance = await nemController.getAccountBalance(address);

			// Assert:
			expect(accountBalance.balance).to.be.equal(absoluteAmount);
			expect(accountBalance.address).to.be.equal(address);
		});
	});

	describe('getUnconfirmedTransactions', () => {
		it('should return unconfirmed transactions', async () => {
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

			const getUnconfirmedTransactionsStub = stub(nemRequest, 'getUnconfirmedTransactions');

			getUnconfirmedTransactionsStub.returns(Promise.resolve(mockAxiosResponse(mockUnconfirmedTransactions)));

			// Act:
			const unconfirmedTransactions = await nemController.getUnconfirmedTransactions(address);

			// Assert:
			expect(unconfirmedTransactions.length).to.be.equal(1);
		});
	});
});
