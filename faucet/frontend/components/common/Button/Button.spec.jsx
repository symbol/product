import Button from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Button', () => {
	it('renders content text', () => {
		// Arrange:
		const text = 'CTA';

		// Act:
		render(<Button>{text}</Button>);
		const element = screen.getByRole('button');

		// Assert:
		expect(element.textContent).toEqual(text);
		expect(element).not.toBeDisabled();
	});

	it('should fire onClick event', () => {
		// Arrange:
		let eventFired = false;
		const callback = () => eventFired = true;

		// Act:
		render(<Button onClick={callback} />);
		const element = screen.getByRole('button');
		fireEvent.click(element);

		// Assert:
		expect(eventFired).toEqual(true);
	});

	it('renders disabled button when isLoading is true', () => {
		// Arrange:
		const text = 'CTA';

		// Act:
		render(<Button isLoading={true}>{text}</Button>);
		const element = screen.getByRole('button');

		// Assert:
		expect(element).toBeDisabled();
	});
});
