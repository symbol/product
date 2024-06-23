import Input from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Input', () => {
	it('can render', () => {
		// Arrange:
		const labelText = 'Your Name';
		const placeholderText = 'Enter your name';

		// Act:
		render(<Input label={labelText} placeholder={placeholderText} />);

		// Assert:
		const labelElement = screen.getByText(labelText);
		const inputElement = screen.getByPlaceholderText(placeholderText);

		expect(labelElement).toBeInTheDocument();
		expect(inputElement).toBeInTheDocument();
	});

	it('can render without label', () => {
		// Arrange:
		const placeholderText = 'Enter your name';

		// Act:
		render(<Input placeholder={placeholderText} />);

		// Assert:
		const labelElement = screen.queryByRole('label');

		expect(labelElement).not.toBeInTheDocument();
	});

	it('can render with custom class', () => {
		// Arrange:
		const placeholderText = 'Enter your name';
		const className = 'custom-class';

		// Act:
		render(<Input placeholder={placeholderText} className={className} role='inputBox' />);

		// Assert:
		const inputBoxElement = screen.getByRole('inputBox');

		expect(inputBoxElement).toHaveClass(className);
	});

	it('renders error message when message is not empty', () => {
		// Arrange:
		const placeholderText = 'Enter your name';
		const errorMessage = 'Invalid name';

		// Act:
		render(<Input placeholder={placeholderText} errorMessage={errorMessage} />);

		// Assert:
		const errorMessageElement = screen.getByText(errorMessage);

		expect(errorMessageElement).toBeInTheDocument();
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
