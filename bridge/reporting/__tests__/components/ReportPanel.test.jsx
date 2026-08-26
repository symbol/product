import ReportPanel from '@/components/ReportPanel';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

const BASE_URL = 'https://bridge.example/wrapped';
const tab = {
	id: 'xym-wxym-requests',
	label: 'XYM → WXYM',
	operation: 'wrap',
	resource: 'requests',
	sourceAsset: { ticker: 'XYM', divisibility: 6 },
	destinationAsset: { ticker: 'WXYM', divisibility: 6 },
	sourceNetwork: 'nativeNetwork',
	destinationNetwork: 'wrappedNetwork'
};

const renderPanel = currentTab => render(<ReportPanel baseUrl={BASE_URL} isActive tab={currentTab} />);

describe('ReportPanel', () => {
	it('renders validation error given invalid input', () => {
		// Arrange:
		renderPanel(tab);
		const input = screen.getByRole('textbox', { name: /filter by address/i });
		fireEvent.change(input, { target: { value: 'invalid' } });

		// Act:
		fireEvent.submit(input.closest('form'));

		// Assert:
		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Enter a valid Symbol or Ethereum address');
	});

	it('accepts a valid search and removes an existing validation error', () => {
		// Arrange:
		renderPanel(tab);
		const input = screen.getByRole('textbox', { name: /filter by address/i });
		fireEvent.change(input, { target: { value: 'invalid' } });
		fireEvent.submit(input.closest('form'));

		// Act:
		fireEvent.change(input, { target: { value: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY' } });
		fireEvent.submit(input.closest('form'));

		// Assert:
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(input).toHaveAttribute('aria-invalid', 'false');
	});

	it('clears the search input and its validation error', () => {
		// Arrange:
		renderPanel(tab);
		const input = screen.getByRole('textbox', { name: /filter by address/i });
		fireEvent.change(input, { target: { value: 'invalid' } });
		fireEvent.submit(input.closest('form'));

		// Act:
		fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

		// Assert:
		expect(input).toHaveValue('');
		expect(input).toHaveAttribute('aria-invalid', 'false');
		expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
	});

	it('selects one payout status at a time', () => {
		// Arrange:
		renderPanel(tab);
		const allButton = screen.getByRole('button', { name: 'All' });
		const sentButton = screen.getByRole('button', { name: 'Sent' });
		const failedButton = screen.getByRole('button', { name: 'Failed' });

		// Act:
		fireEvent.click(sentButton);

		// Assert:
		expect(allButton).toHaveAttribute('aria-pressed', 'false');
		expect(failedButton).toHaveAttribute('aria-pressed', 'false');
		expect(sentButton).toHaveAttribute('aria-pressed', 'true');
	});

	it('does not show payout filters for error reports', () => {
		// Arrange:
		const errorTab = { ...tab, id: 'xym-wxym-errors', resource: 'errors' };

		// Act:
		renderPanel(errorTab);

		// Assert:
		expect(screen.queryByRole('group', { name: 'Payout status' })).not.toBeInTheDocument();
	});
});
