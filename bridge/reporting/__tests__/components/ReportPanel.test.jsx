import { fetchReportPage } from '@/api/bridge';
import ReportPanel from '@/components/ReportPanel';
import { ERROR_ROW, ERROR_TAB, REQUEST_TAB, SECOND_ERROR_ROW } from '@/test-utils/fixtures';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('@/api/bridge');

const BASE_URL = 'https://bridge.example/wrapped';

const renderPanel = currentTab => render(<ReportPanel baseUrl={BASE_URL} isActive tab={currentTab} />);

describe('ReportPanel', () => {
	beforeEach(() => {
		fetchReportPage.mockImplementation(() => new Promise(() => {}));
	});

	it('renders validation error given invalid input', () => {
		// Arrange:
		renderPanel(REQUEST_TAB);
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
		renderPanel(REQUEST_TAB);
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
		renderPanel(REQUEST_TAB);
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
		renderPanel(REQUEST_TAB);
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
		// Act:
		renderPanel(ERROR_TAB);

		// Assert:
		expect(screen.queryByRole('group', { name: 'Payout status' })).not.toBeInTheDocument();
	});

	it('loads and renders the active report table', async () => {
		// Arrange:
		fetchReportPage.mockResolvedValue({
			data: [ERROR_ROW],
			hasMore: false,
			nextOffset: 1
		});

		// Act:
		renderPanel(ERROR_TAB);
		const table = await screen.findByRole('table');

		// Assert:
		expect(within(table).getByText('Required message is missing')).toBeInTheDocument();
		expect(fetchReportPage).toHaveBeenCalledWith(expect.objectContaining({
			baseUrl: BASE_URL,
			offset: 0,
			operation: REQUEST_TAB.operation,
			resource: ERROR_TAB.resource,
			signal: expect.anything()
		}));
	});

	it('shows no records found when the report is empty', async () => {
		// Arrange:
		fetchReportPage.mockResolvedValue({ data: [], hasMore: false, nextOffset: 0 });

		// Act:
		renderPanel(ERROR_TAB);
		const text = await screen.findByText('No records found.');

		// Assert:
		expect(text).toBeInTheDocument();
	});

	it('shows end of report when the last page contains records', async () => {
		// Arrange:
		fetchReportPage.mockResolvedValue({ data: [ERROR_ROW], hasMore: false, nextOffset: 1 });

		// Act:
		renderPanel(ERROR_TAB);
		const text = await screen.findByText('End of report');

		// Assert:
		expect(text).toBeInTheDocument();
	});

	it('show loading status when requesting report page', () => {
		// Act:
		renderPanel(ERROR_TAB);

		// Assert:
		expect(screen.getByRole('status')).toHaveTextContent('Loading report…');
	});

	it('show alert when error response from fetch report page', async () => {
		// Arrange:
		fetchReportPage.mockRejectedValue(new Error('Service unavailable'));

		// Act:
		renderPanel(ERROR_TAB);
		const alert = await screen.findByRole('alert');

		// Assert:
		expect(alert).toHaveTextContent('Service unavailable');
	});

	it('does not load an inactive report', () => {
		// Act:
		render(<ReportPanel baseUrl={BASE_URL} isActive={false} tab={REQUEST_TAB} />);

		// Assert:
		expect(fetchReportPage).not.toHaveBeenCalled();
	});

	it('reloads the report when its sort direction changes', async () => {
		// Arrange:
		fetchReportPage.mockResolvedValue({
			data: [ERROR_ROW],
			hasMore: false,
			nextOffset: 1
		});
		renderPanel(ERROR_TAB);
		const sortButton = await screen.findByRole('button', {
			name: 'Sort by request block height ascending'
		});

		// Act:
		fireEvent.click(sortButton);

		// Assert:
		await waitFor(() => expect(fetchReportPage).toHaveBeenCalledTimes(2));
		expect(fetchReportPage).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 1 }));
	});

	it('retries a failed report load', async () => {
		// Arrange:
		fetchReportPage
			.mockRejectedValueOnce(new Error('Service unavailable'))
			.mockResolvedValueOnce({
				data: [ERROR_ROW],
				hasMore: false,
				nextOffset: 1
			});
		renderPanel(ERROR_TAB);
		const loadError = await screen.findByRole('alert');

		// Act:
		fireEvent.click(within(loadError).getByRole('button', { name: 'Retry' }));

		// Assert:
		expect(await screen.findByRole('table')).toBeInTheDocument();
		expect(fetchReportPage).toHaveBeenCalledTimes(2);
	});

	it('appends the next report page when the scroll sentinel is reached', async () => {
		// Arrange:
		fetchReportPage
			.mockResolvedValueOnce({
				data: [ERROR_ROW],
				hasMore: true,
				nextOffset: 1
			})
			.mockResolvedValueOnce({
				data: [SECOND_ERROR_ROW],
				hasMore: false,
				nextOffset: 2
			});
		renderPanel(ERROR_TAB);
		const table = await screen.findByRole('table');
		await waitFor(() => expect(global.intersectionObserverInstances).toHaveLength(1));

		// Act:
		act(() => global.intersectionObserverInstances[0].callback([{ isIntersecting: true }]));

		// Assert:
		await waitFor(() => screen.findByRole('table'));

		expect(within(table).getAllByRole('row')).toHaveLength(3);
		expect(within(table).getByText(ERROR_ROW.errorMessage)).toBeInTheDocument();
		expect(within(table).getByText(SECOND_ERROR_ROW.errorMessage)).toBeInTheDocument();

		expect(fetchReportPage).toHaveBeenCalledTimes(2);
		expect(fetchReportPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }));
	});
});
