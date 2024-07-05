import ValuePrice from '@/components/ValuePrice';
import { render, screen } from '@testing-library/react';

describe('components/ValuePrice', () => {
	const runValuePriceTest = (change, expectedChangeText, expectedClassName) => {
		// Arrange:
		const value = 5;
		const expectedValueText = '$5';

		// Act:
		render(<ValuePrice value={value} change={change} />);
		const valueElement = screen.getByText(expectedValueText);
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
		runValuePriceTest(change, expectedChangeText, expectedClassName);
	});

	it('renders price decrease', () => {
		// Arrange:
		const change = -2;
		const expectedChangeText = '-2%';
		const expectedClassName = 'changeDecrease';

		// Act + Assert:
		runValuePriceTest(change, expectedChangeText, expectedClassName);
	});
});
