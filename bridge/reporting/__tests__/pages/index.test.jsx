import { fetchBridgeConfiguration } from '@/api/bridge';
import config from '@/config';
import { Home, getServerSideProps } from '@/pages/index';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('@/api/bridge');
jest.mock('@/components/ReportPanel', () => {
	const ReportPanel = ({ baseUrl, tab }) => (
		<div data-base-url={baseUrl} data-testid={`report-panel-${tab.id}`} />
	);
	return ReportPanel;
});

describe('Home', () => {
	const bridgeBaseUrls = {
		native: 'https://bridge.example/native',
		wrapped: 'https://bridge.example/wrapped'
	};
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

	const renderHome = () => render(<Home bridgeBaseUrls={bridgeBaseUrls} bridgeConfigurations={bridgeConfigurations} />);

	it('returns bridge base URLs with bridge type keys', async () => {
		// Arrange:
		fetchBridgeConfiguration.mockResolvedValue(bridgeConfigurations);

		// Act:
		const result = await getServerSideProps();

		// Assert:
		expect(result).toEqual({
			props: {
				bridgeBaseUrls: {
					native: config.PUBLIC_BRIDGE_NATIVE_URL,
					wrapped: config.PUBLIC_BRIDGE_WRAPPED_URL
				},
				bridgeConfigurations
			}
		});
	});

	it('passes the wrapped base URL to wrapped bridge panels', () => {
		// Arrange:
		renderHome();

		// Act:
		const reportPanel = screen.getByTestId('report-panel-xym-wxym-requests');

		// Assert:
		expect(reportPanel.getAttribute('data-base-url')).toBe(bridgeBaseUrls.wrapped);
	});

	it('passes the native base URL to native bridge panels', () => {
		// Arrange:
		renderHome();

		// Act:
		const reportPanel = screen.getByTestId('report-panel-xym-eth-requests');

		// Assert:
		expect(reportPanel.getAttribute('data-base-url')).toBe(bridgeBaseUrls.native);
	});

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
