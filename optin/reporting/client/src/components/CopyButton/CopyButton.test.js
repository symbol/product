import CopyButton from './';
import {render, screen} from '@testing-library/react';

test('render copy button component', () => {
	// Arrange:
	const textToCopy = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';

	// Act:
	render(<CopyButton value={textToCopy}/>);

	// Assert:
	expect(screen.getByRole('button')).toBeInTheDocument();
});


test('copy button onCopy handler', () => {
	// Arrange:
	const textToCopy = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';
	const onCopyHandler = jest.fn();

	render(<CopyButton value={textToCopy} onCopy={onCopyHandler}/>);
	const element = screen.getByRole('button');

	// Act:
	element.click();

	// Assert:
	expect(onCopyHandler).toHaveBeenCalledWith(textToCopy);
});
