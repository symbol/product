import Home from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		loadingStatus: {
			isLoading: false,
			message: ''
		},
		selectedAccount: {
			address: 'address 1',
			label: 'wallet 1'
		},
		mosaics: [],
		transactions: [],
		currency: {
			symbol: 'usd',
			currencyPerXYM: 0.25
		}
	},
	symbolSnap: {
		getSnap: jest.fn()
	}
};

describe('components/Home', () => {
	const assertModalScreen = async (walletState, expectedModal) => {
		// Arrange:
		context.walletState = {
			...context.walletState,
			...walletState
		};

		// Act:
		testHelper.customRender(<Home />, context);

		const textElement = await screen.findByText(expectedModal);

		// Assert:
		expect(textElement).toBeInTheDocument();
	};

	it('renders ConnectMetamask modal when metamask is installed but snap is not installed', async () => {
		await assertModalScreen({ isSnapInstalled: false }, 'Connect MetaMask');
	});
});
