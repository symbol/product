import CopyButton from './';
import Helper from '../../utils/helper';
import {fireEvent, render, screen} from '@testing-library/react';

// Arrange:
const textToCopy = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';
jest.mock('./../../utils/helper', () => ({copyToClipboard: jest.fn()}));

describe('CopyButton Component', () => {
	it('should render copy button component', () => {
		// Act:
		render(<CopyButton value={textToCopy}/>);

		// Assert:
		expect(screen.getByRole('button')).toBeInTheDocument();
	});

	it('should call custom onCopy handler when button is clicked', () => {
		// Arrange more:
		const onCopyHandler = jest.fn();

		render(<CopyButton value={textToCopy} onCopy={onCopyHandler}/>);
		const element = screen.getByRole('button');

		// Act:
		fireEvent.click(element);

		// Assert:
		expect(onCopyHandler).toHaveBeenCalledWith(textToCopy);
	});

	it('should call default onCopy handler when button is clicked', () => {
		// Arrange:
		render(<CopyButton value={textToCopy} />);
		const element = screen.getByRole('button');

		// Act:
		fireEvent.click(element);

		// Assert:
		expect(Helper.copyToClipboard).toHaveBeenCalledWith(textToCopy);
	});

	it('should not render when the value to be copied is falsy', () => {
		// Arrange:
		const textToCopy = '';

		// Act:
		render(<CopyButton value={textToCopy}/>);

		// Assert:
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
