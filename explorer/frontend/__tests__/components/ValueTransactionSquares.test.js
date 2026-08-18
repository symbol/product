import '@testing-library/jest-dom';
import ValueTransactionSquares, { MAX_TRANSACTION_SQUARES } from '@/app/components/ValueTransactionSquares';
import { render, screen } from '@testing-library/react';

describe('ValueTransactionSquares', () => {
	const createTransactions = count => Array.from({ length: count }, (_, index) => ({ fee: index, hash: `hash-${index}` }));

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
});
