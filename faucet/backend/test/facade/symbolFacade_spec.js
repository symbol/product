import symbolFacade from '../../src/facade/symbolFacade.js';
import testConfigurationFactory from '../testConfigurationFactory.js';
import chai from 'chai';
import { restore, stub } from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const { expect } = chai;

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

describe('symbol facade', () => {
	const address = 'TDRWAPRUEP7DEVLYVCWDM6OD4RGCSMJMM43E7PQ';

	afterEach(restore);

	describe('isValidAddress', () => {
		it('should return true when Symbol address provided', () => {
			// Arrange:
			const symbolAddress = 'TDRWAPRUEP7DEVLYVCWDM6OD4RGCSMJMM43E7PQ';

			// Act:
			const result = symbolFacade.isValidAddress(symbolAddress);

			// Assert:
			expect(result).to.be.equal(true);
		});

		it('should return false when Nem address provided', () => {
			// Arrange:
			const nemAddress = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';

			// Act:
			const result = symbolFacade.isValidAddress(nemAddress);

			// Assert:
			expect(result).to.be.equal(false);
		});
	});

	describe('faucetAddress', () => {
		it('should return faucet address derived from the private key in the config', () => {
			// Act:
			const faucetAddress = symbolFacade.faucetAddress();

			// Assert:
			expect(faucetAddress).to.be.equal('TDABFEGKRADYE3ETIMDPKLMNVZ22OU7XADOOHSY');
		});
	});

	describe('transfer', () => {
		it('returns transaction hash', async () => {
			// Arrange:
			stub(symbolFacade, 'getCurrencyMosaicId').returns(Promise.resolve('72C0212E67A08BCE'));

			stub(symbolFacade, 'getNetworkTimestamp').returns(Promise.resolve(8804535542));

			stub(symbolFacade.client, 'announceTransaction');

			// Act:
			const transactionHash = await symbolFacade.transfer(10, address);

			// Assert:
			expect(transactionHash).to.be.equal('5C4BCD7073840D0D11471DD6298ED090BCA5C27C9353C6BD31DCC6E972A7FFEC');
		});
	});

	describe('getAccountBalance', () => {
		const assertAccountBalance = async (accountInfo, expectedResult) => {
			// Arrange:
			stub(symbolFacade, 'getCurrencyMosaicId').returns(Promise.resolve('72C0212E67A08BCE'));

			stub(symbolFacade.client, 'getAccountInfo').returns(Promise.resolve(mockAxiosResponse(accountInfo)));

			// Act:
			const accountBalance = await symbolFacade.getAccountBalance(address);

			// Assert:
			expect(accountBalance).to.be.equal(expectedResult);
		};

		it('returns account balance 0 when no mosaics are present', async () => {
			await assertAccountBalance(testConfigurationFactory.createAccountInfo([]), 0);
		});

		it('returns account balance amount when currency mosaic is present', async () => {
			await assertAccountBalance(testConfigurationFactory.createAccountInfo([{
				id: '72C0212E67A08BCE',
				amount: '1000000'
			}]), 1000000);
		});

		it('returns account balance 0 when currency mosaic is not present', async () => {
			await assertAccountBalance(testConfigurationFactory.createAccountInfo([{
				id: '4C3A0FB828D8AF73',
				amount: '1000000'
			}]), 0);
		});

		it('returns account balance 0 when getAccountInfo response ResourceNotFound', async () => {
			await assertAccountBalance({ code: 'ResourceNotFound' }, 0);
		});
	});

	describe('getUnconfirmedTransactionsCount', () => {
		it('returns number of unconfirmed transactions when address provided', async () => {
			// Arrange:
			const unconfirmedTransferTransactions = testConfigurationFactory.createUnconfirmedTransferTransactions();

			stub(symbolFacade.client, 'getUnconfirmedTransferTransactions')
				.returns(Promise.resolve(mockAxiosResponse(unconfirmedTransferTransactions)));

			// Act:
			const unconfirmedTransactionsCount = await symbolFacade.getUnconfirmedTransactionsCount(address);

			// Assert:
			expect(unconfirmedTransactionsCount).to.be.equal(1);
		});
	});

	describe('getCurrencyMosaicId', () => {
		it('returns network currency mosaic id', async () => {
			// Arrange:
			const networkProperties = testConfigurationFactory.createNetworkProperties();

			stub(symbolFacade.client, 'getNetworkProperties').returns(Promise.resolve(mockAxiosResponse(networkProperties)));

			// Act:
			const currencyMosaicId = await symbolFacade.getCurrencyMosaicId();

			// Assert:
			expect(currencyMosaicId).to.be.equal('72C0212E67A08BCE');
		});
	});

	describe('getNetworkTimestamp', () => {
		it('returns network timestamp', async () => {
			// Arrange:
			const networkTime = {
				communicationTimestamps: {
					sendTimestamp: '8000',
					receiveTimestamp: '1000'
				}
			};

			stub(symbolFacade.client, 'getNetworkTime').returns(Promise.resolve(mockAxiosResponse(networkTime)));

			// Act:
			const timestamp = await symbolFacade.getNetworkTimestamp();

			// Assert:
			expect(timestamp).to.be.equal(8000n);
		});
	});

	describe('config', () => {
		it('returns faucet config', () => {
			// Act:
			const config = symbolFacade.config();

			// Assert:
			expect(config).to.deep.equal({
				faucetAddress: 'TDABFEGKRADYE3ETIMDPKLMNVZ22OU7XADOOHSY',
				currency: 'XYM',
				sendOutMaxAmount: 500000000,
				mosaicDivisibility: 6,
				minFollowers: 10,
				minAccountAge: 30
			});
		});
	});
});
