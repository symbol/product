import '@testing-library/jest-dom';
import ValueTransactionSquares, { MAX_TRANSACTION_SQUARES } from '@/app/components/ValueTransactionSquares';
import { act, render, screen } from '@testing-library/react';

const mockChart = jest.fn();
jest.mock('react-apexcharts', () => props => {
	mockChart(props);
	return null;
});

describe('ValueTransactionSquares', () => {
	const createTransactions = count =>
		Array.from({ length: count }, (_, index) => ({ fee: index, hash: `hash-${index}`, type: 16724, amount: index }));

	it('renders the fees of a block within the cap', () => {
		// Arrange:
		const data = createTransactions(3);

		// Act:
		render(<ValueTransactionSquares data={data} transactionCount={data.length} />);

		// Assert:
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
		expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
	});

	it('renders the empty message when there is nothing to show', () => {
		// Act:
		render(<ValueTransactionSquares data={[]} transactionCount={0} />);

		// Assert:
		expect(screen.getByText('message_emptyTable')).toBeInTheDocument();
		expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
	});

	it('renders the fees of a block sitting exactly on the cap', () => {
		// Arrange:
		const data = createTransactions(MAX_TRANSACTION_SQUARES);

		// Act:
		render(<ValueTransactionSquares data={data} transactionCount={MAX_TRANSACTION_SQUARES} />);

		// Assert:
		expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
	});

	it('renders the cap message when the block is too large for the chart', () => {
		// Act:
		render(<ValueTransactionSquares data={[]} transactionCount={MAX_TRANSACTION_SQUARES + 1} />);

		// Assert:
		expect(screen.getByText('message_tooManyTransactionsToVisualize')).toBeInTheDocument();
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
	});

	it('renders the loading state instead of any message', () => {
		// Act:
		render(<ValueTransactionSquares data={[]} transactionCount={MAX_TRANSACTION_SQUARES + 1} isLoading />);

		// Assert:
		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
	});

	describe('data point interactions', () => {
		const selectDataPoint = (options, dataPointIndex) => {
			act(() => {
				options.chart.events.dataPointSelection(null, null, { dataPointIndex });
			});
		};

		it('shows the selected transaction when a data point is clicked', () => {
			// Arrange:
			const data = createTransactions(3);
			render(<ValueTransactionSquares isTransactionPreviewEnabled data={data} transactionCount={data.length} />);
			const { options } = mockChart.mock.calls[0][0];

			// Act:
			selectDataPoint(options, 1);

			// Assert:
			expect(screen.getByText(data[1].hash)).toBeInTheDocument();
		});

		it('hides the selected transaction when its data point is clicked again', () => {
			// Arrange:
			const data = createTransactions(3);
			render(<ValueTransactionSquares isTransactionPreviewEnabled data={data} transactionCount={data.length} />);
			const { options } = mockChart.mock.calls[0][0];
			selectDataPoint(options, 1);

			// Act:
			selectDataPoint(options, 1);

			// Assert:
			expect(screen.queryByText(data[1].hash)).not.toBeInTheDocument();
		});

		it('does not show the selected transaction when the preview is disabled', () => {
			// Arrange:
			const data = createTransactions(3);
			render(<ValueTransactionSquares data={data} transactionCount={data.length} />);
			const { options } = mockChart.mock.calls[0][0];

			// Act:
			selectDataPoint(options, 1);

			// Assert:
			expect(screen.queryByText(data[1].hash)).not.toBeInTheDocument();
		});

		it('builds a tooltip showing the fee of the hovered data point', () => {
			// Arrange:
			const data = createTransactions(3);
			render(<ValueTransactionSquares data={data} transactionCount={data.length} />);
			const { options } = mockChart.mock.calls[0][0];

			// Act:
			const tooltipHtml = options.tooltip.custom({ series: [[100, 200, 300]], seriesIndex: 0, dataPointIndex: 2 });

			// Assert:
			expect(tooltipHtml).toContain('300');
		});
	});
});
