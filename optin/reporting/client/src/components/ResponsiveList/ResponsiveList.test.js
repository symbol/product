import ResponsiveList from './';
import {render, screen} from '@testing-library/react';
import React from 'react';

describe('ResponsiveList Component', () => {
	it('should render with single item', () => {
		// Arrange:
		const item = 'item 1';
		const children = React.Children.toArray([<div>{item}</div>]);
		const showMoreText = 'MORE';

		// Act:
		render(<ResponsiveList showMoreText={showMoreText}>{children}</ResponsiveList>);

		// Assert:
		expect(screen.queryByTestId('visible-text').textContent).toBe(item);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('should render with multiple items, first item is visible with custom show more text', () => {
		// Arrange:
		const items = ['item 1', 'item 2', 'item 3'];
		const children = React.Children.toArray(items.map(text => <div>{text}</div>));
		const showMoreText = 'Custom show more text';

		// Act:
		render(<ResponsiveList showMoreText={showMoreText}>{children}</ResponsiveList>);

		// Assert:
		expect(screen.queryByTestId('full-list').textContent).toBe(items.join(''));
		expect(screen.getByTestId('visible-text').textContent).toBe(items[0]);
		expect(screen.getByRole('button', {name: showMoreText})).toBeInTheDocument();
	});

	it('should render with multiple items when visible text is explicitly set', () => {
		// Arrange:
		const childrenTexts = ['item 1', 'item 2', 'item 3'];
		const children = React.Children.toArray(childrenTexts.map(text => <div>{text}</div>));
		const showMoreText = 'more';
		const visibleText = 'Visible Text';

		// Act:
		render(<ResponsiveList title="List Title" visible={visibleText}>{children}</ResponsiveList>);

		// Assert:
		expect(screen.queryByTestId('full-list').textContent).toBe(childrenTexts.join(''));
		expect(screen.getByTestId('visible-text').textContent).toBe(visibleText);
		expect(screen.getByRole('button', {name: showMoreText})).toBeInTheDocument();
	});

	it('should render with no children', () => {
		// Arrange:
		render(<ResponsiveList/>);

		// Assert:
		expect(screen.getByTestId('visible-text').textContent).toBe('');
	});
});
