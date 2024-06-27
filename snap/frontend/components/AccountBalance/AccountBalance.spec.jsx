import AccountBalance from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		currency: {
			symbol: 'usd',
			price: 0.25
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
		context.walletState.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				name: 'symbol.xym',
				amount: 100
			},
			{
				id: '3C596F764B5A1160',
				name: null,
				amount: 2
			}
		];

		assertAccountBalance(context, '100 XYM', '25.00 usd');
	});

	it('renders xym balance and converted currency with 0 balance when symbol.xym mosaic does not found', () => {
		// Arrange:
		context.walletState.mosaics = [
			{
				id: '3C596F764B5A1160',
				name: null,
				amount: 2
			}
		];

		assertAccountBalance(context, '0 XYM', '0.00 usd');
	});

	it('renders xym balance and converted currency with 0 balance when mosaics is empty', () => {
		assertAccountBalance(context, '0 XYM', '0.00 usd');
	});

});
