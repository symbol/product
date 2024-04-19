import Button from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Button', () => {
	it('can render', () => {
		// Arrange:
		const buttonText = 'Click me';

		// Act:
		render(<Button>Click me</Button>);

		// Assert:
		const buttonElement = screen.getByRole('button');

		expect(buttonElement).toHaveTextContent(buttonText);
	});

	it('can render with custom class', () => {
		// Arrange:
		const className = 'custom-class';

		// Act:
		render(<Button className={className}>Click me</Button>);

		// Assert:
		const buttonElement = screen.getByRole('button');

		expect(buttonElement).toHaveClass(className);
	});

	it('can render with icon', async () => {
		// Arrange:
		const iconPath = './icon.url';
		const buttonText = 'Click me';

		// Act:
		render(<Button icon={iconPath}>{buttonText}</Button>);

		// Assert:
		const buttonElement = screen.getByRole('button');
		const imageElement = screen.getByRole('img');

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
