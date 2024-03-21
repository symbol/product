import Button from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Button', () => {
	it('renders Button', () => {
		// Arrange:
		const buttonText = 'Click me';

		// Act:
		render(<Button>Click me</Button>);
		const buttonElement = screen.getByRole('button');

		// Assert:
		expect(buttonElement).toHaveTextContent(buttonText);
	});

	it('renders Button with custom class', () => {
		// Arrange:
		const className = 'custom-class';

		// Act:
		render(<Button className={className}>Click me</Button>);
		const buttonElement = screen.getByRole('button');

		// Assert:
		expect(buttonElement).toHaveClass(className);
	});

	it('renders Button with icon', async () => {
		// Arrange:
		const iconPath = './icon.url';
		const buttonText = 'Click me';

		// Act:
		render(<Button icon={iconPath}>{buttonText}</Button>);
		const buttonElement = screen.getByRole('button');
		const imageElement = screen.getByRole('img');

		// Assert:
		expect(buttonElement).toHaveTextContent(buttonText);
		expect(imageElement).toHaveAttribute('src', iconPath);
	});

	it('should fire onClick event', () => {
		// Arrange:
		const handleClick = jest.fn();

		// Act:
		render(<Button onClick={handleClick} />);
		const buttonElement = screen.getByRole('button');
		fireEvent.click(buttonElement);

		// Assert:
		expect(handleClick).toHaveBeenCalled();
	});
});
