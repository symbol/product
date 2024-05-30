import Home from '.';
import testHelper from '../testHelper';
import { act, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setLoadingStatus: jest.fn(),
		setNetwork: jest.fn()
	},
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
		getSnap: jest.fn(),
		initialSnap: jest.fn()
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

	it('calls initializeSnap when isSnapInstalled is true', async () => {
		// Arrange:
		const mockNetwork = {
			identifier: 152,
			networkName: 'testnet',
			url: 'http://localhost:3000'
		};

		context.walletState.isSnapInstalled = true;

		context.symbolSnap.initialSnap.mockResolvedValue({
			network: mockNetwork
		});

		// Act:
		await act(() => testHelper.customRender(<Home />, context));

		// Assert:
		expect(context.dispatch.setLoadingStatus).toHaveBeenCalledWith({
			isLoading: true,
			message: 'Initializing Snap...'
		});
		expect(context.dispatch.setNetwork).toHaveBeenCalledWith(mockNetwork);
		expect(context.dispatch.setLoadingStatus).toHaveBeenCalledWith({
			isLoading: false,
			message: ''
		});
	});
});
