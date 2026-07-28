import { Home } from '@/pages/index';
import { fireEvent, render, screen, within } from '@testing-library/react';

describe('Home', () => {
	const bridgeConfigurations = {
		wrapped: {
			enabled: true,
			nativeNetwork: { network: 'testnet' }
		},
		native: {
			enabled: false,
			nativeNetwork: { network: 'testnet' }
		}
	};

	const renderHome = () => render(<Home bridgeConfigurations={bridgeConfigurations} />);

	it('renders bridge network status', () => {
		// Arrange:
		renderHome();

		// Act:
		const networkStatus = screen.getByText(/TESTNET · 1\/2 BRIDGES ONLINE/);

		// Assert:
		expect(networkStatus.textContent).toContain('TESTNET · 1/2 BRIDGES ONLINE');
	});

	it('updates the active tab label', () => {
		// Arrange:
		renderHome();
		const activeReport = screen.getByText('Active report').parentElement;

		// Assert:
		expect(within(activeReport).getByText('XYM → WXYM')).toBeTruthy();

		// Act:
		fireEvent.click(screen.getByRole('tab', { name: /WXYM → XYM$/ }));

		// Assert:
		expect(within(activeReport).getByText('WXYM → XYM')).toBeTruthy();
	});

	it('renders all bridge report tabs', () => {
		// Arrange:
		const expectedLabels = [
			'XYM → WXYM',
			'WXYM → XYM',
			'XYM → ETH',
			'XYM → WXYM Errors',
			'WXYM → XYM Errors',
			'XYM → ETH Errors'
		];

		// Act:
		renderHome();
		const tabs = screen.getAllByRole('tab');

		// Assert:
		expect(tabs).toHaveLength(expectedLabels.length);
		expectedLabels.forEach((label, index) => {
			expect(tabs[index].textContent).toContain(label);
		});
	});
});
