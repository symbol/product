import SortHeader from '@/components/SortHeader';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

describe('SortHeader', () => {
	it.each([
		[0, 'ascending', '↓'],
		[1, 'descending', '↑']
	])('renders sort value %s as %s and handles a sort change', (sort, direction, indicator) => {
		// Arrange:
		const onSortChange = jest.fn();
		render(<SortHeader onSortChange={onSortChange} sort={sort} />);
		const button = screen.getByRole('button', {
			name: `Sort by request block height ${direction}`
		});

		// Act:
		fireEvent.click(button);

		// Assert:
		expect(button).toHaveTextContent('Request hash');
		expect(button).toHaveTextContent(indicator);
		expect(button).toHaveAttribute('title', 'Sorted by request block height');
		expect(onSortChange).toHaveBeenCalledTimes(1);
	});
});
