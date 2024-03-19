import Home from '.';
import { render, screen } from '@testing-library/react';

describe('components/Home', () => {
	it('renders home page', async () => {
		// Act:
		render(<Home />);
		const textElement = await screen.findByText('Symbol Snap');

		// Assert:
		expect(textElement).toBeInTheDocument();
	});
});
