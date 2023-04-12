/* eslint-disable testing-library/no-node-access */
import TextBox from '.';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('components/TextBox', () => {
	it('should render placeholder', () => {
		// Arrange:
		const callback = jest.fn();
		const placeholder = 'placeholder text';

		// Act:
		render(<TextBox
			onChange={callback}
			placeholder={placeholder}
		/>);
		const element = screen.getByRole('textbox');

		// Assert:
		expect(element.placeholder).toEqual(placeholder);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it('should fire onChange event with entered text', () => {
		// Arrange:
		const callback = jest.fn();
		const text = 'entered text';

		// Act:
		render(<TextBox
			onChange={callback}
		/>);
		const element = screen.getByRole('textbox');
		userEvent.type(element, text);

		// Assert:
		expect(callback).toHaveBeenCalledWith(text);
		expect(callback).toHaveBeenCalledTimes(text.length);
	});
});
