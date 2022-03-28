import { render, screen } from '@testing-library/react';
import Home from './index';

test('renders Home page', () => {
  render(<Home />);
  const linkElement = screen.getByText(/NEM Address Balance/i);
  expect(linkElement).toBeInTheDocument();
});
