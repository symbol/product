import '@testing-library/jest-dom';
import Table from '@/app/components/Table';
import { fireEvent, render, screen } from '@testing-library/react';

describe('Table empty results and retrieval errors', () => {
	const createProps = source => ({ [source]: [], columns: [{ key: 'height' }], isLastPage: true });

	it.each(['data', 'sections'])('shows the empty-success message for an empty %s result', source => {
		// Arrange:
		const props = createProps(source);

		// Act:
		render(<Table {...props} />);

		// Assert:
		expect(screen.getByText('message_emptyTable')).toBeInTheDocument();
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
	});

	it.each(['data', 'sections'])('shows a retry action instead of the empty-success message after a failed %s request', source => {
		// Arrange:
		const props = createProps(source);

		// Act:
		render(<Table {...props} isError />);

		// Assert:
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
		expect(screen.getByText('button_tryAgain')).toBeInTheDocument();
	});

	it.each(['data', 'sections'])('notifies once when retry is clicked after a failed %s request', source => {
		// Arrange:
		const onEndReached = jest.fn();
		const props = { ...createProps(source), onEndReached, isError: true };
		render(<Table {...props} />);

		// Act:
		fireEvent.click(screen.getByText('button_tryAgain'));

		// Assert:
		expect(onEndReached).toHaveBeenCalledTimes(1);
	});

	it.each(['data', 'sections'])('hides retry and empty-success messages while a %s request is retrying', source => {
		// Arrange:
		const props = createProps(source);
		const { rerender } = render(<Table {...props} isError />);

		// Act:
		rerender(<Table {...props} isLoading />);

		// Assert:
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
	});

	it.each(['data', 'sections'])('restores the empty-success message after a %s request recovers', source => {
		// Arrange:
		const props = createProps(source);
		const { rerender } = render(<Table {...props} isError />);

		// Act:
		rerender(<Table {...props} />);

		// Assert:
		expect(screen.getByText('message_emptyTable')).toBeInTheDocument();
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
	});
});
