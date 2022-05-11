/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
import ResponsiveList from './';
import {render} from '@testing-library/react';
import React from 'react';

test('render responsive list component', () => {
	// Arrange:
	const childrenTexts = ['item 1', 'item 2', 'item 3'];
	const children = React.Children.toArray(childrenTexts.map(text => <div>{text}</div>));
	const showMoreText = 'MORE';

	// Act:
	const {container} = render(<ResponsiveList showMoreText={showMoreText}>{children}</ResponsiveList>);

	// Assert:
	const containerFullListElement = container.querySelector('.container-full-list');
	childrenTexts.forEach((text, index) => {
		expect(containerFullListElement.querySelectorAll('div')[index].textContent).toBe(text);
	});

	const containerResponsiveVisibleElement = container.querySelector('.container-responsive-list-visible');
	expect(containerResponsiveVisibleElement.firstChild.textContent).toBe(childrenTexts[0]);

	const containerResponsiveMoreElement = container.querySelector('.container-responsive-list-more');
	expect(containerResponsiveMoreElement.firstChild.textContent).toBe(showMoreText);
});
