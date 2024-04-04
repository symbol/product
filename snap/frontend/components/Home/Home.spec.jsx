import Home from '.';
import WalletContextProvider from '../../context/store';
import { render, screen } from '@testing-library/react';

describe('components/Home', () => {
	const assertModalScreen = async (walletState, expectedModal) => {
		// Arrange:
		const context = {
			walletState,
			dispatch: jest.fn()
		};

		// Act:
		render(<WalletContextProvider value={context}>
			<Home />
		</WalletContextProvider>);

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

	it('renders connected when metamask and snap are installed', async () => {
		await assertModalScreen({ isMetamaskInstalled: true, isSnapInstalled: true }, 'connected');
	});
});
