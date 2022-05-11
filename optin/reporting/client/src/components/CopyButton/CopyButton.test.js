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

	// Act:
	render(<CopyButton value={textToCopy} onCopy={onCopyHandler}/>);

	// Assert:
	const element = screen.getByRole('button');
	element.click();
	expect(onCopyHandler).toHaveBeenCalledWith(textToCopy);
});
