import Input from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Input', () => {
	it('renders Input', () => {
		// Arrange:
		const labelText = 'Your Name';
		const placeholderText = 'Enter your name';

		// Act:
		render(<Input label={labelText} placeholder={placeholderText} />);
		const labelElement = screen.getByText(labelText);
		const inputElement = screen.getByPlaceholderText(placeholderText);

		// Assert:
		expect(labelElement).toBeInTheDocument();
		expect(inputElement).toBeInTheDocument();
	});

	it('renders Input without label', () => {
		// Arrange:
		const placeholderText = 'Enter your name';

		// Act:
		render(<Input placeholder={placeholderText} />);
		const labelElement = screen.queryByRole('label');

		// Assert:
		expect(labelElement).not.toBeInTheDocument();
	});

	it('renders Input with custom class', () => {
		// Arrange:
		const placeholderText = 'Enter your name';
		const className = 'custom-class';

		// Act:
		render(<Input placeholder={placeholderText} className={className} role='inputBox' />);
		const inputBoxElement = screen.getByRole('inputBox');

		// Assert:
		expect(inputBoxElement).toHaveClass(className);
	});

	it('should fire onChange event', () => {
		// Arrange:
		const placeholderText = 'Enter your name';
		const inputValue = 'John Doe';
		const handleChange = jest.fn();

		render(<Input placeholder={placeholderText} onChange={handleChange} />);
		const inputElement = screen.getByPlaceholderText(placeholderText);

		// Act:
		fireEvent.change(inputElement, { target: { value: inputValue } });

		// Assert:
		expect(handleChange).toHaveBeenCalled();
		expect(inputElement.value).toEqual(inputValue);
	});
});
