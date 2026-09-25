import '@testing-library/jest-dom';
import { Dropdown } from '@/app/components/Dropdown';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Dropdown', () => {
	it('opens and notifies once when an option is selected with the mouse', async () => {
		// Arrange:
		const user = userEvent.setup();
		const onChange = jest.fn();
		const options = [
			{ value: 'ja', label: '日本語' },
			{ value: 'en', label: 'English' }
		];
		render(<Dropdown options={options} value="en" onChange={onChange} />);

		// Act:
		await user.click(screen.getByRole('button', { name: 'English' }));
		await user.click(screen.getByRole('button', { name: '日本語' }));

		// Assert:
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('ja');
	});

	it('focuses the toggle when tabbed to', async () => {
		// Arrange:
		const user = userEvent.setup();
		render(<Dropdown options={[{ value: 'mainnet', label: 'Mainnet' }]} value="mainnet" onChange={jest.fn()} />);
		const toggle = screen.getByRole('button', { name: 'Mainnet' });

		// Act:
		await user.tab();

		// Assert:
		expect(toggle).toHaveFocus();
	});

	it('moves focus to an option after opening the menu and tabbing', async () => {
		// Arrange:
		const user = userEvent.setup();
		const options = [
			{ value: 'mainnet', label: 'Mainnet' },
			{ value: 'testnet', label: 'Testnet' }
		];
		render(<Dropdown options={options} value="mainnet" onChange={jest.fn()} />);

		// Act:
		await user.tab();
		await user.keyboard('{Enter}');
		await user.tab();
		await user.tab();

		// Assert:
		expect(screen.getByRole('button', { name: 'Testnet' })).toHaveFocus();
	});

	it('selects the focused option with Space and notifies once', async () => {
		// Arrange:
		const user = userEvent.setup();
		const onChange = jest.fn();
		const options = [
			{ value: 'mainnet', label: 'Mainnet' },
			{ value: 'testnet', label: 'Testnet' }
		];
		render(<Dropdown options={options} value="mainnet" onChange={onChange} />);

		// Act:
		await user.tab();
		await user.keyboard('{Enter}');
		await user.tab();
		await user.tab();
		await user.keyboard(' ');

		// Assert:
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('testnet');
	});
});
