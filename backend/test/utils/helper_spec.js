import { config } from '../../src/config/index.js';
import helper from '../../src/utils/helper.js';
import { expect } from 'chai';
import symbolSDK from 'symbol-sdk';

describe('helper', () => {
	it('can convert absolute amount to relative amount.', () => {
		// Arrange:
		const amount = 1000000;

		// Act:
		const relativeAmount = helper.toRelativeAmount(amount);

		// Assert:
		expect(relativeAmount).to.equal(1);
	});

	it('can convert relative amount to absolute amount.', () => {
		// Arrange:
		const amount = 1;

		// Act:
		const absoluteAmount = helper.toAbsoluteAmount(amount);

		// Assert:
		expect(absoluteAmount).to.equal(1000000);
	});

	it('can validate input.', () => {
		// Arrange:
		const mockValidationInputs = [
			{
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 1000000000,
				unconfirmedTransactionsCount: 0,
				expectedError: ''
			},
			{
				transferAmount: 700000000,
				receiptBalance: 10,
				faucetBalance: 1000000000,
				unconfirmedTransactionsCount: 0,
				expectedError: 'error_amount_max_request'
			},
			{
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 0,
				unconfirmedTransactionsCount: 0,
				expectedError: 'error_fund_drains'
			},
			{
				transferAmount: 100000000,
				receiptBalance: 200000001,
				faucetBalance: 1000000000,
				unconfirmedTransactionsCount: 0,
				expectedError: 'error_account_high_balance'
			},
			{
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 1000000000,
				unconfirmedTransactionsCount: 1,
				expectedError: 'error_transaction_pending'
			}
		];

		mockValidationInputs.forEach(({
			transferAmount,
			receiptBalance,
			faucetBalance,
			unconfirmedTransactionsCount,
			expectedError
		}) => {
			// Act:
			const errorMessage = helper.faucetValidation({
				transferAmount,
				receiptBalance,
				faucetBalance,
				unconfirmedTransactionsCount
			});

			// Assert:
			expect(errorMessage).to.equal(expectedError);
		});
	});

	describe('checkTwitterAccount', () => {
		const assertCheckTwitterAccountTests = ({ createdAt, followersCount }, expectResult) => {
			// Arrange + Act:
			const result = helper.checkTwitterAccount(createdAt, followersCount);

			// Assert:
			expect(result).to.be.equal(expectResult);
		};

		it('returns false when followers count is 10 and account age is less than 30 days', () => assertCheckTwitterAccountTests({
			createdAt: new Date(),
			followersCount: 10
		}, false));

		it('returns false when followers count less than 10 and account age at least 30 days', () => assertCheckTwitterAccountTests({
			createdAt: '2022-10-15T00:00:00.000Z',
			followersCount: 9
		}, false));

		it('returns true when followers count is 10 and account age more than 30 days', () => assertCheckTwitterAccountTests({
			createdAt: '2022-10-15T00:00:00.000Z',
			followersCount: 10
		}, true));

		it('returns true when followers count is 11 and account age more than 30 days', () => assertCheckTwitterAccountTests({
			createdAt: '2022-10-15T00:00:00.000Z',
			followersCount: 11
		}, true));
	});

	describe('signTransaction', () => {
		const { PrivateKey, facade, symbol } = symbolSDK;

		it('returns signed transaction hash and payload when nem facade provided', () => {
			// Arrange:
			const protocolFacade = new facade.NemFacade(config.network);
			const keyPair = new facade.NemFacade.KeyPair(new PrivateKey(config.nem.faucetPrivateKey));
			const networkTimestamp = 10000;

			const transferTransaction = protocolFacade.transactionFactory.create({
				type: 'transfer_transaction_v1',
				fee: BigInt(100000),
				signerPublicKey: keyPair.publicKey,
				recipientAddress: 'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
				timestamp: networkTimestamp,
				deadline: networkTimestamp + 3600,
				amount: BigInt(100)
			});

			// Act:
			const signedTransaction = helper.signTransaction(protocolFacade, keyPair, transferTransaction);

			// Assert:
			expect(signedTransaction).to.be.deep.equal({
				transactionHash: '79601B9D72B96C62655FBD7CD3B0873A2E5CE132BD33EF20E9B541AB7CC2070E',
				payload: {
					data: '01010000010000981027000020000000A14D10B4CB05BDD4D1551773C4235A3C151A9FDF4'
						+ 'B5EE3163A5BBB9BDF96275DA086010000000000203500002800000054414C494345355646'
						+ '364A3546594D5443423741335147364F49524452555844574A474656584E57640000000000000000000000',
					signature: '3D81A2D33E2D51062DA2A875A7D57D6746E5FD376511FA1A5357A1F4ADF5566FE522C8C559394CC48E7254C'
					+ '714AD0E1F73A40B23F376E43C609C0B1947043302'
				}
			});
		});

		it('returns signed transaction hash and payload when symbol facade provided', () => {
			// Arrange:
			const protocolFacade = new facade.SymbolFacade(config.network);
			const keyPair = new facade.SymbolFacade.KeyPair(new PrivateKey(config.symbol.faucetPrivateKey));

			const transferTransaction = protocolFacade.transactionFactory.create({
				type: 'transfer_transaction_v1',
				fee: BigInt(100000),
				signerPublicKey: keyPair.publicKey,
				recipientAddress: 'TBL6O45I3HL2J3X3LPRVCEAES3S6KTWLNZ76NDQ',
				mosaics: [],
				message: [],
				deadline: new symbol.NetworkTimestamp(10000).addHours(2).timestamp
			});

			// Act:
			const signedTransaction = helper.signTransaction(protocolFacade, keyPair, transferTransaction);

			// Assert:
			expect(signedTransaction).to.be.deep.equal({
				transactionHash: 'C11FEEF97318BDD65CD45A189C51029D5DC451B5A9D40C0D2B9388EF13B34006',
				payload: {
					payload: 'A00000000000000068EC250E53C005FC09EA1FFF2C06E216290A24039D7AEC03F7355'
						+ 'AFC3324DD91E8D02A7A52D80B613A11666E8560481420CCF0340E1A5EEFD854878E503B5'
						+ '20154F65566363F0B6EC81E4D06B20401E468E762AB49923541631B485268E576C800000'
						+ '00001985441A08601000000000010046E00000000009857E773A8D9D7A4EEFB5BE351100'
						+ '496E5E54ECB6E7FE68E0000000000000000'
				}
			});
		});
	});
});
