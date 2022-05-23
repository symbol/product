import Balance from './';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

describe('Balance Component', () => {
	it('should render balance component with total', () => {
		// Arrange:
		const balances = [100_000_000, 200_180_000, 300_280_000];
		const expectedRelativeBalances = ['100.00', '200.18', '300.28'];
		const expectedTotalRelativeBalance = '600.46';

		// Act:
		render(<Balance values={balances} renderTotal="true"/>);

		// Assert:
		expectedRelativeBalances.forEach(relativeBalance => {
			expect(screen.getByText(relativeBalance)).toBeInTheDocument();
		});
		expect(screen.getByText(expectedTotalRelativeBalance)).toBeInTheDocument();
	});

	it('should render balance component when renderTotal is false', () => {
		// Arrange:
		const balances = [100_000_000, 200_180_000, 300_280_000];
		const expectedTotalRelativeBalance = '600.46';

		// Act:
		render(<Balance values={balances} renderTotal={false}/>);

		// Assert:
		expect(screen.queryByText(expectedTotalRelativeBalance)).not.toBeInTheDocument();
	});

	it('should not render total when value length is less than 2, even if renderTotal is true', () => {
		// Arrange:
		const balance = 100_000_000;
		const expectedRelativeBalance = '100.00';

		// Act:
		render(<Balance values={[balance]} renderTotal={true}/>);

		// Assert:
		expect(screen.getByText(expectedRelativeBalance)).toBeInTheDocument();
		expect(screen.queryByTestId('sub-total-value')).not.toBeInTheDocument();
	});
});
