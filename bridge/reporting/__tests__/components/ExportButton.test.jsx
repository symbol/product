import { REQUEST_ROW, REQUEST_TAB } from '../test-utils/fixtures';
import { fetchAllReportRows } from '@/api/bridge';
import ExportButton from '@/components/ExportButton';
import { downloadCsv } from '@/utils/csv';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/api/bridge', () => ({ fetchAllReportRows: jest.fn() }));
jest.mock('@/utils/csv', () => ({
	...jest.requireActual('@/utils/csv'),
	downloadCsv: jest.fn()
}));

const criteria = {
	baseUrl: 'https://bridge.example/wrapped',
	limit: 200,
	offset: 0,
	operation: 'wrap',
	payoutStatus: 2,
	resource: 'requests',
	search: 'A'.repeat(64),
	sort: 0
};

describe('ExportButton', () => {
	beforeEach(() => jest.clearAllMocks());

	it('can exports all matching rows once', async () => {
		// Arrange:
		fetchAllReportRows.mockImplementation(async (_, onProgress) => {
			onProgress(1);
			return [REQUEST_ROW];
		});
		render(<ExportButton criteria={criteria} tab={REQUEST_TAB} />);

		// Act:
		const button = screen.getByRole('button', { name: /export all csv/i });
		fireEvent.click(button);

		// Assert:
		await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Exporting 1 rows'));
		expect(fetchAllReportRows).toHaveBeenCalledTimes(1);
		expect(downloadCsv).toHaveBeenCalledTimes(1);
	});

	it('does not create a partial file when any batch fails', async () => {
		// Arrange:
		fetchAllReportRows.mockRejectedValue(new Error('network'));
		render(<ExportButton criteria={criteria} tab={REQUEST_TAB} />);

		// Act:
		const button = screen.getByRole('button', { name: /export all csv/i });
		fireEvent.click(button);

		// Assert:
		expect(await screen.findByRole('alert')).toHaveTextContent('CSV export failed. No file was created.');
		expect(downloadCsv).not.toHaveBeenCalled();
	});
});
