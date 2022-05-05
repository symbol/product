import CopyButton from './';
import {render, screen} from '@testing-library/react';

test('render copy button component', () => {
	// Arrange:
	const textToCopy = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';
	const onCopyHandler = jest.fn();
    
	// Act:
	render(<CopyButton value={textToCopy} onCopy={onCopyHandler}/>);

	// Assert:
	const element = screen.getByRole('button');
	expect(element).toBeInTheDocument();
	element.click();
	expect(onCopyHandler).toHaveBeenCalled();
});
