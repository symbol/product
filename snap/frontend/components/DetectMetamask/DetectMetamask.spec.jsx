import DetectMetamask from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/DetectMetamask', () => {
	it('renders title, description and button children with isOpen is true', () => {
		// Arrange:
		const title = 'You don\'t have the Metamask extension';
		const description =
			'You need to install Metamask extension in order to use the Symbol snap.';
		const children = 'Download MetaMask';

		// Act:
		render(<DetectMetamask isOpen={true} onRequestClose={() => { }} />);

		// Assert:
		const titleElement = screen.getByText(title);
		const descriptionElement = screen.getByText(description);
		const childrenElement = screen.getByText(children);

		expect(titleElement).toBeInTheDocument();
		expect(descriptionElement).toBeInTheDocument();
		expect(childrenElement).toBeInTheDocument();
	});

	it('does not render when isOpen is false', () => {
		// Arrange + Act:
		render(<DetectMetamask isOpen={false} />);

		// Assert:
		const modalElement = screen.queryByRole('modal');

		expect(modalElement).not.toBeInTheDocument();
	});

	describe('onRequestClose', () => {
		describe('mousedown', () => {
			it('does not called when clicked in modal box', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				render(<DetectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('modal');

				// Act:
				fireEvent.click(element);

				// Assert:
				expect(onRequestClose).not.toHaveBeenCalled();
			});

			it('called when overlay is clicked', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				render(<DetectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('overlay');

				// Act:
				fireEvent.mouseDown(element);

				// Assert:
				expect(onRequestClose).toHaveBeenCalled();
			});
		});
	});
});
