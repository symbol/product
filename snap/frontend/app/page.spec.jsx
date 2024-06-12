import Main from './page';
import symbolSnapFactory from '../utils/snap';
import detectEthereumProvider from '@metamask/detect-provider';
import { act, render } from '@testing-library/react';
import React from 'react';

describe('Main', () => {
	it('renders the HomeComponent when a provider is detected and symbolSnapFactory is created', async () => {
		// Arrange:
		const mockProvider = { isMetaMask: true };
		detectEthereumProvider.mockResolvedValue(mockProvider);
		jest.spyOn(symbolSnapFactory, 'create').mockReturnValue({
			getSnap: () => ({
				'enabled': true
			}),
			initialSnap: () => ({
				network: {
					identifier: 152,
					networkName: 'testnet',
					url: 'http://localhost:3000'
				},
				accounts: {
					'0x1': {
						id: '0x1',
						addressIndex: 0,
						type: 'metamask'
					}
				}
			})
		});

		// Act:
		let component;
		await act(async () => {
			component = render(<Main />);
		});

		// Assert:
		const connectionStatus = component.queryByRole('connection-status');
		expect(connectionStatus).toBeInTheDocument();
	});

	it('renders the DetectMetamask component when provider is detected but symbolSnap is not created', async () => {
		// Arrange:
		const mockProvider = { isMetaMask: false };
		detectEthereumProvider.mockResolvedValue(mockProvider);

		// Act:
		let component;
		await act(async () => {
			component = render(<Main />);
		});

		// Assert:
		const text = component.queryByText('Download MetaMask');
		expect(text).toBeInTheDocument();
	});
});
