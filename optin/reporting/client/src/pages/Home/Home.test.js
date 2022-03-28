import Home from './index';
import { render, screen } from '@testing-library/react';

test('renders Home page', () => {
	render(<Home />);
	const linkElement = screen.getByText(/NEM Address Balance/i);
	expect(linkElement).toBeInTheDocument();
});
