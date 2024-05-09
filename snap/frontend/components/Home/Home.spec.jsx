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

	it('renders DetectMetamask modal when metamask is not install', async () => {
		await assertModalScreen({ isMetamaskInstalled: false, isSnapInstalled: false }, 'Download MetaMask');
	});

	it('renders ConnectMetamask modal when metamask is installed but snap is not installed', async () => {
		await assertModalScreen({ isMetamaskInstalled: true, isSnapInstalled: false }, 'Connect MetaMask');
	});
});
