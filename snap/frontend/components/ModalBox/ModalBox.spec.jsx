import ModalBox from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/ModalBox', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	const assertModalBox = isOpen => {
		// Arrange:
		const modalText = 'This is awesome';

		// Act:
		render(<ModalBox isOpen={isOpen}>{modalText}</ModalBox>);
		const modalElement = screen.queryByText(modalText);

		// Assert:
		if (isOpen)
			expect(modalElement).toBeInTheDocument();
		else
			expect(modalElement).not.toBeInTheDocument();
	};

	it('renders content with isOpen is true', () => {
		assertModalBox(true);
	});

	it('does not render when isOpen is false', () => {
		assertModalBox(false);
	});

	describe('onRequestClose', () => {
		describe('mousedown', () => {
			const assertModalBoxCloseWithMouseClick = (roleElement, isClose) => {
				// Arrange:
				const onRequestClose = jest.fn();

				// Act:
				render(<ModalBox isOpen={true} onRequestClose={onRequestClose}>This is awesome</ModalBox>);
				const element = screen.getByRole(roleElement);
				fireEvent.click(element);

				// Assert:
				if (isClose)
					expect(onRequestClose).toHaveBeenCalled();
				else
					expect(onRequestClose).not.toHaveBeenCalled();
			};

			it('called when close button is clicked', () => {
				assertModalBoxCloseWithMouseClick('button', true);
			});

			it('does not called when clicked in modal box', () => {
				assertModalBoxCloseWithMouseClick('modal', false);
			});

			it('called when overlay is clicked', () => {
				// Arrange:
				const onRequestClose = jest.fn();

				// Act:
				render(<ModalBox isOpen={true} onRequestClose={onRequestClose}>This is awesome</ModalBox>);
				fireEvent.mouseDown(document);

				// Assert:
				expect(onRequestClose).toHaveBeenCalled();
			});
		});

		describe('keydown', () => {
			const assertModalBoxCloseWithKeydown = (key, isClose) => {
				// Arrange:
				const onRequestClose = jest.fn();

				// Act:
				render(<ModalBox isOpen={true} onRequestClose={onRequestClose}>This is awesome</ModalBox>);
				fireEvent.keyDown(document, { key });

				// Assert:
				if (isClose)
					expect(onRequestClose).toHaveBeenCalled();
				else
					expect(onRequestClose).not.toHaveBeenCalled();
			};

			it('called when ESC key is pressed', () => {
				assertModalBoxCloseWithKeydown('Escape', true);
			});

			it('does not called when A key is pressed', () => {
				assertModalBoxCloseWithKeydown('A', false);
			});
		});
	});
});
