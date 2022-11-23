const helper = require('../../src/utils/helper');
const { expect } = require('chai');

// setup process env
before(() => {
	process.env.MOSAIC_DIVISIBILITY = 6;
	process.env.RECEIPT_MAX_BALANCE = 200000000;
	process.env.SEND_OUT_MAX_AMOUNT = 500000000;
});

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
				receiptAddress: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 1000000000,
				unconfirmedTransactions: [],
				expectedError: ''
			},
			{
				receiptAddress: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
				transferAmount: 700000000,
				receiptBalance: 10,
				faucetBalance: 1000000000,
				unconfirmedTransactions: [],
				expectedError: 'Transfer amount cannot more than 500'
			},
			{
				receiptAddress: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 0,
				unconfirmedTransactions: [],
				expectedError: 'Faucet balance not enough to pay out'
			},
			{
				receiptAddress: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
				transferAmount: 100000000,
				receiptBalance: 200000001,
				faucetBalance: 1000000000,
				unconfirmedTransactions: [],
				expectedError: 'Your account balance is too high'
			},
			{
				receiptAddress: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3',
				transferAmount: 100000000,
				receiptBalance: 0,
				faucetBalance: 1000000000,
				unconfirmedTransactions: [{
					transaction: {
						recipient: 'TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3'
					}
				}],
				expectedError: 'You have pending transactions, please wait for it to be confirmed'
			}
		];

		mockValidationInputs.forEach(({
			receiptAddress,
			transferAmount,
			receiptBalance,
			faucetBalance,
			unconfirmedTransactions,
			expectedError
		}) => {
			// Act:
			const errorMessage = helper.nemFaucetValidation({
				receiptAddress,
				transferAmount,
				receiptBalance,
				faucetBalance,
				unconfirmedTransactions
			});

			// Assert:
			expect(errorMessage).to.equal(expectedError);
		});
	});
});
