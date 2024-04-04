import useWalletInstallation from './useWalletInstallation';
import { WalletContextProvider } from '../context';
import { renderHook } from '@testing-library/react';

describe('hooks/useWalletInstallation', () => {
	beforeEach(() => {
		window.ethereum = {
			isMetaMask: true
		};
	});

	it('dispatch setMetamaskInstalled if metamask install in browser', async () => {
		// Arrange:
		const dispatch = jest.fn();
		const walletState = { isMetamaskInstalled: false, isSnapInstalled: false };
		const context = { walletState, dispatch };

		// Act:
		renderHook(() => useWalletInstallation(), {
			wrapper: ({ children }) => (
				<WalletContextProvider value={context}>
					{children}
				</WalletContextProvider>
			)
		});

		// Assert:
		expect(dispatch).toHaveBeenCalledWith({ type: 'setMetamaskInstalled', payload: true });
	});
});
