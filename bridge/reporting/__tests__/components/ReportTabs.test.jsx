import ReportTabs from '@/components/ReportTabs';
import { fireEvent, render, screen } from '@testing-library/react';

describe('ReportTabs', () => {
	const tabs = [
		{ id: 'one', label: 'XYM → WXYM' },
		{ id: 'two', label: 'WXYM → XYM' },
		{ id: 'three', label: 'XYM → ETH' }
	];

	it('selects tabs with click', () => {
		// Arrange:
		const onChange = jest.fn();
		render(<ReportTabs activeTabId="one" onChange={onChange} tabs={tabs} />);

		// Act:
		fireEvent.click(screen.getByRole('tab', { name: /WXYM → XYM/ }));

		// Assert:
		expect(onChange).toHaveBeenCalledWith('two');
	});
});
