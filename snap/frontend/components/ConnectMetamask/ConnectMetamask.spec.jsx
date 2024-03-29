import ConnectMetamask from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/ConnectMetamask', () => {
	it('renders title, description and children with isOpen is true', () => {
		// Arrange:
		const title = 'Connect to MetaMask Symbol Snap';
		const description = 'If you do not have the Symbol snap installed you will be prompted to install it.';
		const children = 'Connect MetaMask';

		// Act:
		render(<ConnectMetamask isOpen={true} onRequestClose={() => {}} />);
		const titleElement = screen.getByText(title);
		const descriptionElement = screen.getByText(description);
		const childrenElement = screen.getByText(children);

		// Assert:
		expect(titleElement).toBeInTheDocument();
		expect(descriptionElement).toBeInTheDocument();
		expect(childrenElement).toBeInTheDocument();
	});

	it('does not render when isOpen is false', () => {
		// Arrange + Act:
		render(<ConnectMetamask isOpen={false} />);
		const modalElement = screen.queryByRole('modal');

		// Assert:
		expect(modalElement).not.toBeInTheDocument();
	});

	describe('onRequestClose', () => {
		describe('mousedown', () => {
			it('does not called when clicked in modal box', () => {
				// Arrange:
				const onRequestClose = jest.fn();

				// Act:
				render(<ConnectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('modal');
				fireEvent.click(element);

				// Assert:
				expect(onRequestClose).not.toHaveBeenCalled();
			});

			it('called when overlay is clicked', () => {
				// Arrange:
				const onRequestClose = jest.fn();

				// Act:
				render(<ConnectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('overlay');
				fireEvent.mouseDown(element);

				// Assert:
				expect(onRequestClose).toHaveBeenCalled();
			});
		});
	});
});
