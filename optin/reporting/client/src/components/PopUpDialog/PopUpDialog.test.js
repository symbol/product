import PopUpDialog from './';
import {fireEvent, render, screen, waitForElementToBeRemoved} from '@testing-library/react';

// Arrange:
const title = 'My Popup Title';
const content = 'My Popup Content';
const buttonText = 'My Button Text';

describe('PopUpDialog Component', () => {
	it('render popup dialog component', () => {
		// Act:
		render(<PopUpDialog title={title} content={content} buttonText={buttonText}/>);

		// Assert:
		expect(screen.getByText(buttonText)).toBeInTheDocument();
	});

	it('should be hidden when button is not clicked yet', () => {
		// Act:
		render(<PopUpDialog title={title} content={content} buttonText={buttonText}/>);

		// Assert:
		expect(screen.queryByText(content)).not.toBeInTheDocument();
		expect(screen.queryByText(title)).not.toBeInTheDocument();
	});

	it('should opened when button is clicked', async() => {
		// Arrange more:
		render(<PopUpDialog title={title} content={content} buttonText={buttonText}/>);

		// Act:
		const button = screen.getByText(buttonText);
		button.click();

		// Assert:
		expect((await screen.findByText(content))).toBeInTheDocument();
		expect((await screen.findByText(title))).toBeInTheDocument();
	});

	it('should be closed when close button is clicked', async () => {
		// Arrange more:
		render(<PopUpDialog title={title} content={content} buttonText={buttonText}/>);
		const button = screen.getByText(buttonText);
		fireEvent.click(button); // popup dialog is visible
		const closeButton = screen.getByRole('button', {name: 'Close'});

		// Act:
		fireEvent.click(closeButton);

		// Assert:
		await waitForElementToBeRemoved(await screen.findByText(title));
		expect(screen.queryByText(content)).not.toBeInTheDocument();
	});
});
