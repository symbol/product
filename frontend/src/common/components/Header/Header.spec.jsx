/* eslint-disable testing-library/no-node-access */
import Header from '.';
import { render, screen } from '@testing-library/react';

describe('components/Header', () => {
	it('should render logo images', () => {
		// Arrange:
		const logoImageAlt = 'Logo';
		const logoWordmarkAlt = 'Faucet';

		// Act:
		render(<Header />);
		const logoImageElement = screen.getByAltText(logoImageAlt);
		const logoWordmarkElement = screen.getByAltText(logoWordmarkAlt);

		// Assert:
		expect(logoImageElement).toBeInTheDocument();
		expect(logoWordmarkElement).toBeInTheDocument();
	});
});
