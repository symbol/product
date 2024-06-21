import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import TablePageLoader from '@/components/TablePageLoader';
import { render, screen } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';


describe('TablePageLoader', () => {
	describe('loading state', () => {
		const runLoadingTest = isLoading => {
			// Act:
			render(<TablePageLoader isLoading={isLoading} />);

			// Assert:

			if (isLoading) {
				expect(screen.getByRole('status')).toBeInTheDocument();
			} else {
				expect(screen.queryByRole('status')).toBeNull();
			}
		};

		it('renders loading state', () => {
			// Act + Assert:
			runLoadingTest(true);
		});

		it('does not render loading state', () => {
			// Act + Assert:
			runLoadingTest(false);
		});
	});

	describe('new page request', () => {
		it('triggers new page request when in view', () => {
			// Arrange:
			const newPageRequest = jest.fn();

			// Act:
			render(<TablePageLoader onLoad={newPageRequest} />);
			mockAllIsIntersecting(false);

			// Assert:
			expect(newPageRequest).toHaveBeenCalledTimes(0);

			// Act:
			mockAllIsIntersecting(true);

			// Assert:
			expect(newPageRequest).toHaveBeenCalledTimes(1);
		});
	});
});
