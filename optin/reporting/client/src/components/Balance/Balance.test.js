import Balance from './';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

test('render balance component', () => {
	// Arrange:
	const balances = [100_000_000, 200_180_000, 300_280_000];
	const expectedRelativeBalances = ['100.00', '200.18', '300.28'];
	const expectedTotalRelativeBalance = '600.46';

	// Act:
	render(<Balance values={balances} renderTotal="true"/>);

	// Assert:
	expectedRelativeBalances.forEach(relativeBalance => {
		const element = screen.getByText(relativeBalance);
		expect(element.textContent).toBe(relativeBalance);
	});
	expect(screen.getByText(expectedTotalRelativeBalance)).toBeInTheDocument();
});
