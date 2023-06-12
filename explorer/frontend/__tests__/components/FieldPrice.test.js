import FieldPrice from '@/components/FieldPrice';
import { render, screen } from '@testing-library/react';

describe('components/FieldPrice', () => {
	const runFieldPriceTest = (change, expectedChangeText, expectedClassName) => {
		// Arrange:
		const value = 5;

		// Act:
		render(<FieldPrice value={value} change={change} />);
		const valueElement = screen.getByText(value.toString());
		const changeElement = screen.getByText(expectedChangeText);

		// Assert:
		expect(valueElement).toBeInTheDocument();
		expect(changeElement).toBeInTheDocument();
		expect(changeElement).toHaveClass(expectedClassName);
	};

	it('renders price increase', () => {
		// Arrange:
		const change = 1;
		const expectedChangeText = '+1%';
		const expectedClassName = 'changeIncrease';

		// Act + Assert:
		runFieldPriceTest(change, expectedChangeText, expectedClassName);
	});

	it('renders price decrease', () => {
		// Arrange:
		const change = -2;
		const expectedChangeText = '-2%';
		const expectedClassName = 'changeDecrease';

		// Act + Assert:
		runFieldPriceTest(change, expectedChangeText, expectedClassName);
	});
});
