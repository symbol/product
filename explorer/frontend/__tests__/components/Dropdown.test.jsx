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

	it('opens with Enter and selects the focused option with Space', async () => {
		// Arrange:
		const user = userEvent.setup();
		const onChange = jest.fn();
		const options = [
			{ value: 'mainnet', label: 'Mainnet' },
			{ value: 'testnet', label: 'Testnet' }
		];
		render(<Dropdown options={options} value="mainnet" onChange={onChange} />);
		const toggle = screen.getByRole('button', { name: 'Mainnet' });

		// Act:
		await user.tab();
		expect(toggle).toHaveFocus();
		await user.keyboard('{Enter}');
		await user.tab();
		await user.tab();
		expect(screen.getByRole('button', { name: 'Testnet' })).toHaveFocus();
		await user.keyboard(' ');

		// Assert:
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('testnet');
	});
});
