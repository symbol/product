import WarningModalBox from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/WarningModalBox', () => {
	it('renders title, description and button children with isOpen is true', () => {
		// Arrange:
		const title = 'This is title';
		const description = 'This is description';
		const children = 'This is children';

		// Act:
		render(<WarningModalBox isOpen={true} title={title} description={description}>{children}</WarningModalBox>);

		// Assert:
		const titleElement = screen.getByText(title);
		const descriptionElement = screen.getByText(description);
		const imageElements = screen.queryAllByRole('img');
		const childrenElement = screen.getByText(children);

		expect(titleElement).toBeInTheDocument();
		expect(descriptionElement).toBeInTheDocument();
		expect(imageElements[0].src.split('/').pop()).toBe('symbol-logo.svg');
		expect(imageElements[1].src.split('/').pop()).toBe('metamask-icon.svg');
		expect(childrenElement).toBeInTheDocument();
	});

	it('does not render when isOpen is false', () => {
		// Arrange + Act:
		render(<WarningModalBox isOpen={false} />);

		// Assert:
		const modalElement = screen.queryByRole('modal');

		expect(modalElement).not.toBeInTheDocument();
	});

	describe('onRequestClose', () => {
		describe('mousedown', () => {
			it('does not called when clicked in modal box', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				render(<WarningModalBox isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('modal');

				// Act:
				fireEvent.click(element);

				// Assert:
				expect(onRequestClose).not.toHaveBeenCalled();
			});

			it('called when overlay is clicked', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				render(<WarningModalBox isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('overlay');

				// Act:
				fireEvent.mouseDown(element);

				// Assert:
				expect(onRequestClose).toHaveBeenCalled();
			});
		});
	});
});
