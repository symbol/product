import useWalletInstallation from './useWalletInstallation';
import { WalletContextProvider } from '../context';
import { act, renderHook } from '@testing-library/react';

describe('hooks/useWalletInstallation', () => {
	const assertSetSnapInstalledDispatch = async (isSymbolSnapInstalled, expectedDispatchCall) => {
		// Arrange:
		const dispatch = jest.fn();
		const walletState = { isSnapInstalled: false };
		const symbolSnap = { getSnap: jest.fn().mockResolvedValue({ enabled: isSymbolSnapInstalled })};
		const context = { dispatch, walletState, symbolSnap };

		const wrapper = ({ children }) => (
			<WalletContextProvider value={context}>
				{children}
			</WalletContextProvider>
		);

		// Act:
		await act(async () => renderHook(() => useWalletInstallation(), { wrapper }));

		// Assert:
		if (expectedDispatchCall) 
			expect(dispatch).toHaveBeenCalledWith(expectedDispatchCall);
		 else 
			expect(dispatch).not.toHaveBeenCalled();
		
	};

	it('dispatch setSnapInstalled action when snap is installed and enabled', async () => {
		await assertSetSnapInstalledDispatch(true, { type: 'setSnapInstalled', payload: true });
	});

	it('does not dispatch setSnapInstalled action when snap is not installed', async () => {
		await assertSetSnapInstalledDispatch(false, null);
	});
});
