import Header from '.';
import { render, screen } from '@testing-library/react';

describe('components/Header', () => {
	it('renders header with logo and explorer account link', () => {
		// Arrange:
		const defaultProps = {
			logoImageSrc: {
				src: 'image/logo-image.png'
			},
			logoWordmarkSrc: {
				src: 'image/logo-wordmark.png'
			},
			faucetAddressLink: 'explorer/account/url'
		};

		// Act:
		render(<Header {...defaultProps} />);

		const logoImageElement = screen.getByAltText('Logo');
		const logoWordElement = screen.getByAltText('Faucet');
		const accountLink = screen.getByRole('link', { name: /faucet/i });

		// Assert:
		expect(logoImageElement).toBeInTheDocument();
		expect(logoWordElement).toBeInTheDocument();

		expect(logoImageElement).toHaveAttribute('src', defaultProps.logoImageSrc.src);
		expect(logoWordElement).toHaveAttribute('src', defaultProps.logoWordmarkSrc.src);

		expect(accountLink).toBeInTheDocument();
		expect(accountLink).toHaveAttribute('href', defaultProps.faucetAddressLink);
	});
});
