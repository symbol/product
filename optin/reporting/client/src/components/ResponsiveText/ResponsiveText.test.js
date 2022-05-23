import ResponsiveText from './';
import {render, screen} from '@testing-library/react';
import React from 'react';

const text = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';

describe('Responsive Text Component', () => {
	const testResponsiveTextComponent = lastPartLength => {
		// Arrange:
		const defaultLastPartLength = 8;
		const firstPartOfText = text.substring(0, text.length - (lastPartLength || defaultLastPartLength));
		const lastPartOfText = text.substring(text.length - (lastPartLength || defaultLastPartLength));

		// Act:
		render(<ResponsiveText value={text} lastPartLength={lastPartLength}/>);

		// Assert:
		expect(screen.getByTestId('first-part').textContent).toBe(firstPartOfText);
		expect(screen.getByTestId('last-part').textContent).toBe(lastPartOfText);
	};

	it('should render when last part length is specified', () => {
		testResponsiveTextComponent(8);
	});

	it('should render with default last part length', () => {
		testResponsiveTextComponent();
	});
});
