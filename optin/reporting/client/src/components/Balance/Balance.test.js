import Balance from './';
import Helper from '../../utils/helper';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

test('render balance component', () => {
	// Arrange:
	const balances = [100_000_000, 200_180_000, 300_280_000];
	
	// Act:
	render(<Balance values={balances} renderTotal="true"/>);

	// Assert:
	balances.forEach(balance => {
		const relativeBalance = Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
		const element = screen.getByText(relativeBalance);
		expect(element.textContent).toBe(relativeBalance);
	});
	const totalBalance = balances.reduce((acc, curr) => acc + curr, 0);
	const relativeTotalBalance = Helper.toRelativeAmount(totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 });
	expect(screen.getByText(relativeTotalBalance)).toBeInTheDocument();
});
