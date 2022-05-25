import ColumnHeader from './';
import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

describe('ColumnHeader', () => {
	const testColumnHeaderSort = (sortDirection, expectedHeaderCls) => {
		// Arrange + Act:
		render(<ColumnHeader title={headerTitle} sortDirection={sortDirection}/>);

		// Assert:
		expect(screen.getByTestId('sort-direction')).toHaveClass(expectedHeaderCls);
	};

	// Arrange:
	const headerTitle = 'Hash';

	it('should render when sort direction is not set', () => {
		// Act:
		render(<ColumnHeader title={headerTitle}/>);

		// Assert:
		expect(screen.getByText(headerTitle)).toBeInTheDocument();
	});

	it('should render with sort direction desc', () => {
		testColumnHeaderSort('desc', 'pi-sort-amount-up');
	});

	it('should render with sort direction asc', () => {
		testColumnHeaderSort('asc', 'pi-sort-amount-down-alt');
	});

	it('should render with sort direction none', () => {
		testColumnHeaderSort('none', 'pi-sort-alt');
	});

	const testToggleSortDirection = (currentSortDirection, expectedSortDirection) => {
		// Arrange:
		const mockOnSort = jest.fn();
		render(<ColumnHeader title={headerTitle} sortDirection={currentSortDirection} onSort={mockOnSort}/>);
		const header = screen.getByRole('button');

		// Act:
		fireEvent.click(header);

		// Assert:
		expect(mockOnSort).toHaveBeenCalledWith(undefined, expectedSortDirection);
	};

	it('should set sort direction from none to desc when clicked', () => {
		testToggleSortDirection('none', 'desc');
	});

	it('should set sort direction from desc to asc when clicked', () => {
		testToggleSortDirection('desc', 'asc');
	});

	it('should set sort direction from asc to none when clicked', () => {
		testToggleSortDirection('asc', 'none');
	});
});
