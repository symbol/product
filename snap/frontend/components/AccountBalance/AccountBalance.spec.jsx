import AccountBalance from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		selectedAccount: {
			...testHelper.generateAccountsState(1)
		},
		currency: {
			symbol: 'usd',
			price: 0.25
		},
		network: {
			currencyMosaicId: 'E74B99BA41F4AFEE'
		},
		mosaicInfo: {
			'E74B99BA41F4AFEE': {
				divisibility: 6
			},
			'3C596F764B5A1160': {
				divisibility: 2
			}
		}
	}
};

describe('components/AccountBalance', () => {
	const assertAccountBalance = (context, xymBalance, convertedCurrency) => {
		// Arrange:
		testHelper.customRender(<AccountBalance />, context);

		// Act:
		const xymBalanceElement = screen.getByText(xymBalance);
		const convertedCurrencyElement = screen.getByText(convertedCurrency);

		// Assert:
		expect(xymBalanceElement).toBeInTheDocument();
		expect(convertedCurrencyElement).toBeInTheDocument();
	};

	it('renders xym balance and converted currency when found symbol.xym mosaic', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				amount: 100000000
			},
			{
				id: '3C596F764B5A1160',
				amount: 200
			}
		];

		assertAccountBalance(context, '100 XYM', '25.00 USD');
	});

	it('renders xym balance with decimal and converted currency when found symbol.xym mosaic', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				amount: 100100000
			},
			{
				id: '3C596F764B5A1160',
				amount: 200
			}
		];

		assertAccountBalance(context, '100.1 XYM', '25.02 USD');
	});

	it('renders xym balance and converted currency with 0 balance when symbol.xym mosaic does not found', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: '3C596F764B5A1160',
				amount: 200
			}
		];

		assertAccountBalance(context, '0 XYM', '0.00 USD');
	});

	it('renders xym balance and converted currency with 0 balance when mosaics is empty', () => {
		assertAccountBalance(context, '0 XYM', '0.00 USD');
	});
});
