/* eslint-disable testing-library/no-node-access */
import Button from '.';
import { fireEvent, render, screen } from '@testing-library/react';

describe('components/Button', () => {
	it('should render content text', () => {
		// Arrange:
		const text = 'CTA';

		// Act:
		render(<Button>{text}</Button>);
		const element = screen.getByRole('button');

		// Assert:
		expect(element.textContent).toEqual(text);
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
});
