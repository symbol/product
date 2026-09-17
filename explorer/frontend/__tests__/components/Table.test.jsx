import '@testing-library/jest-dom';
import Table from '@/app/components/Table';
import { fireEvent, render, screen } from '@testing-library/react';

describe('Table empty results and retrieval errors', () => {
	it.each(['data', 'sections'])('shows retry instead of an empty-success message after a failed %s request', source => {
		// Arrange: both flat and sectioned lists can finish successfully with no results.
		const onEndReached = jest.fn();
		const props = { [source]: [], columns: [{ key: 'height' }], isLastPage: true, onEndReached };
		const { rerender } = render(<Table {...props} />);
		expect(screen.getByText('message_emptyTable')).toBeInTheDocument();

		// Act: the caller reports a retrieval failure with no rows to display.
		rerender(<Table {...props} isError />);

		// Assert: failure is actionable and is not presented as a successful empty result.
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
		fireEvent.click(screen.getByText('button_tryAgain'));
		expect(onEndReached).toHaveBeenCalledTimes(1);

		// During retry neither the old error action nor the empty-success message is shown.
		rerender(<Table {...props} isLoading />);
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();

		// A successful empty response restores the empty-result message.
		rerender(<Table {...props} />);
		expect(screen.getByText('message_emptyTable')).toBeInTheDocument();
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
	});
});
