/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
import ResponsiveText from './';
import {render} from '@testing-library/react';
import React from 'react';

test('render responsive text component', () => {
	// Arrange:
	const text = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';
	const lastPartLength = 8;
	const firstPartOfText = text.substring(0, text.length - lastPartLength);
	const lastPartOfText = text.substring(text.length - lastPartLength);
	
	// Act:
	const {container} = render(<ResponsiveText value={text} lastPartLength={lastPartLength}/>);
    
	// Assert:
	expect(container.querySelector('.container-full-text').textContent).toBe(text);
	expect(container.querySelector('.firstPart').textContent).toBe(firstPartOfText);
	expect(container.querySelector('.lastPart').textContent).toBe(lastPartOfText);
});
