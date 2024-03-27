import Dropdown from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Dropdown', () => {
	// Arrange:
	let label = 'Select an option';
	const options = [
		{ label: 'Option 1', value: 'option1' },
		{ label: 'Option 2', value: 'option2' },
		{ label: 'Option 3', value: 'option3' }
	];

	const onSelect = jest.fn();

	it('renders Dropdown with custom class', () => {
		// Arrange:
		const className = 'custom-class';

		// Act:
		render(<Dropdown label={label} options={options} onSelect={onSelect} className={className} role='dropdown' />);
		const dropdownElement = screen.getByRole('dropdown');

		// Assert:
		expect(dropdownElement).toHaveClass(className);
	});

	describe('toggle', () => {
		it('expand dropdown list', () => {
			// Arrange:
			render(<Dropdown label={label} options={options} onSelect={onSelect} />);

			// Act:
			fireEvent.click(screen.getByText(label));

			// Assert:
			expect(screen.getByText(label)).toBeInTheDocument();
			options.forEach(option => {
				expect(screen.queryByText(option.label)).toBeInTheDocument();
			});
		});

		it('collapse dropdown list when dropdown is expanded', () => {
			// Arrange:
			render(<Dropdown label={label} options={options} onSelect={onSelect} />);
			fireEvent.click(screen.getByText(label));

			// Act:
			fireEvent.click(screen.getByText(label));

			// Assert:
			expect(screen.getByText(label)).toBeInTheDocument();
			options.forEach(option => {
				expect(screen.queryByText(option.label)).not.toBeInTheDocument();
			});
		});
	});

	it('should fire onSelect event when clicked on dropdown item', () => {
		// Arrange:
		render(<Dropdown label={label} options={options} onSelect={onSelect} />);
		fireEvent.click(screen.getByText(label));

		// Act:
		fireEvent.click(screen.getByText(options[0].label));

		// Assert:
		expect(onSelect).toHaveBeenCalledWith(options[0]);
	});
});
