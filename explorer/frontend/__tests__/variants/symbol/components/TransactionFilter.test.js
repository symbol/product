import '@testing-library/jest-dom';
import { itVariant } from '../../../test-utils/variants';
import TransactionFilter from '@/app/variants/symbol/components/TransactionFilter';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockLanguage = 'en';

jest.mock('next-i18next', () => ({
	useTranslation: () => ({
		t: key => key,
		i18n: { language: mockLanguage }
	})
}));

const fields = [
	{
		name: 'types',
		title: 'filter_type',
		conflicts: ['mosaic', 'to'],
		type: 'transaction-type',
		options: [{ type: 'TRANSFER' }, { type: 'AGGREGATE_COMPLETE' }]
	},
	{ name: 'from', title: 'filter_from', conflicts: [], type: 'account' },
	{ name: 'to', title: 'filter_to', conflicts: ['types'], type: 'account' },
	{ name: 'mosaic', title: 'filter_mosaic', conflicts: ['types'], type: 'mosaic' },
	{ name: 'height', title: 'filter_block', conflicts: [], type: 'block' }
];

const renderFilter = (value = {}, onChange = jest.fn(), onClear = jest.fn(), isDisabled = false) => {
	const renderResult = render(<TransactionFilter
		isSelectedItemsShown
		data={fields}
		value={value}
		isDisabled={isDisabled}
		onChange={onChange}
		onClear={onClear}
		search={jest.fn()}
	/>);

	return { onChange, onClear, ...renderResult };
};

const openField = fieldName => {
	fireEvent.click(screen.getByRole('button', { name: fieldName }));
	return screen.getByRole('dialog');
};

const submitDirectFilter = async (user, fieldName, value) => {
	const dialog = openField(fieldName);
	await user.type(within(dialog).getByRole('textbox'), `${value}{Enter}`);
	return dialog;
};

describe('variants/symbol/components/TransactionFilter', () => {
	afterEach(() => {
		mockLanguage = 'en';
	});

	itVariant('symbol')('does not notify while direct input is edited', () => {
		// Arrange:
		const { onChange } = renderFilter();
		const dialog = openField('filter_from');
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';
		const input = within(dialog).getByRole('textbox');

		// Act:
		fireEvent.change(input, { target: { value: address.toLowerCase() } });

		// Assert:
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('applies once when Enter is pressed in the input', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';

		// Act:
		await submitDirectFilter(user, 'filter_from', address.toLowerCase());

		// Assert:
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ from: address });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	itVariant('symbol')('has no Apply or Cancel buttons and dismisses a draft by clicking outside', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const dialog = openField('filter_mosaic');

		await user.type(within(dialog).getByRole('textbox'), '72c0212e67a08bce');

		expect(dialog.querySelector('button')).toBeNull();
		expect(within(dialog).getByAltText('Close')).toBeInTheDocument();

		// Act:
		fireEvent.click(dialog);

		// Assert:
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	itVariant('symbol')('rejects empty block input without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a value.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a malformed FROM address on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_from', 'TINVALID');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid Symbol address.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a malformed TO address on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_to', 'NINVALID');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid Symbol address.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a 39-character FROM address with an invalid character', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const address = 'T00000000000000000000000000000000000000';

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_from', address);

		// Assert:
		expect(address).toHaveLength(39);
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid Symbol address.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a 39-character TO address with an invalid character', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const address = 'N11111111111111111111111111111111111111';

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_to', address);

		// Assert:
		expect(address).toHaveLength(39);
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid Symbol address.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a malformed mosaic ID on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_mosaic', '72c0212e67a08bc');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a 16-character mosaic ID.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a 16-character mosaic ID with a non-hex character', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const mosaic = '72c0212e67a08bcg';

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_mosaic', mosaic);

		// Assert:
		expect(mosaic).toHaveLength(16);
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a 16-character mosaic ID.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects zero block height on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '0');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a positive block height.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a negative block height on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '-1');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a positive block height.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a non-integer block height on Enter without applying it', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '1.5');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a positive block height.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects the same-digit block height above the maximum on Enter', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '9223372036854775808');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a block height between 1 and 9223372036854775807.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('rejects a longer block height above the maximum on Enter', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_block', '10000000000000000000');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a block height between 1 and 9223372036854775807.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('uses English validation text for an unsupported language', async () => {
		// Arrange:
		mockLanguage = 'de';
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_mosaic', 'invalid');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a 16-character mosaic ID.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('uses English validation text when the language is undefined', async () => {
		// Arrange:
		mockLanguage = undefined;
		const user = userEvent.setup();
		const { onChange } = renderFilter();

		// Act:
		const dialog = await submitDirectFilter(user, 'filter_mosaic', 'invalid');

		// Assert:
		expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a 16-character mosaic ID.');
		expect(onChange).not.toHaveBeenCalled();
	});

	itVariant('symbol')('normalizes a mosaic ID without numeric conversion', () => {
		// Arrange:
		const { onChange } = renderFilter();
		const dialog = openField('filter_mosaic');

		// Act:
		fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '72c0212e67a08bce' } });
		fireEvent.submit(dialog.querySelector('form'));

		// Assert:
		expect(onChange).toHaveBeenCalledWith({ mosaic: '72C0212E67A08BCE' });
	});

	itVariant('symbol')('normalizes the maximum block height as an exact string', () => {
		// Arrange:
		const { onChange } = renderFilter();
		const dialog = openField('filter_block');
		const height = '9223372036854775807';

		// Act:
		fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: `000${height}` } });
		fireEvent.submit(dialog.querySelector('form'));

		// Assert:
		expect(onChange).toHaveBeenCalledWith({ height });
	});

	itVariant('symbol')('preserves type conflicts for direct filters', () => {
		// Arrange:
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';
		renderFilter({ types: 'TRANSFER', from: address });

		// Assert:
		expect(screen.getByRole('button', { name: 'filter_to' })).toHaveAttribute('aria-disabled', 'true');
		expect(screen.getByRole('button', { name: 'filter_mosaic' })).toHaveAttribute('aria-disabled', 'true');
	});

	itVariant('symbol')('removes an individual direct filter without clearing the others', () => {
		// Arrange:
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';
		const { onChange } = renderFilter({ types: 'TRANSFER', from: address });

		// Act:
		fireEvent.click(screen.getByLabelText('Remove filter_from'));

		// Assert:
		expect(onChange).toHaveBeenCalledWith({ types: 'TRANSFER' });
	});

	itVariant('symbol')('clears all selected filters through CLEAR', () => {
		// Arrange:
		const { onClear } = renderFilter({ types: 'TRANSFER', from: 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y' });

		// Act:
		fireEvent.click(screen.getByText('button_clear'));

		// Assert:
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	itVariant('symbol')('disables TYPE when a conflicting direct condition is selected', () => {
		// Arrange:
		renderFilter({ mosaic: '72C0212E67A08BCE' });

		// Assert:
		expect(screen.getByText('filter_type').closest('[role="button"]')).toHaveAttribute('aria-disabled', 'true');
	});

	itVariant('symbol')('uses the shared filter click controls without native buttons', () => {
		// Arrange:
		renderFilter({ from: 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y' });
		const trigger = screen.getByRole('button', { name: 'filter_from' });
		const selected = screen.getByLabelText('Remove filter_from');

		// Act:
		fireEvent.click(trigger);

		// Assert:
		expect(trigger.tagName).toBe('DIV');
		expect(selected.tagName).toBe('DIV');
		expect(trigger).not.toHaveAttribute('tabindex');
		expect(selected).not.toHaveAttribute('tabindex');
		expect(screen.getByRole('dialog').querySelector('button')).toBeNull();
	});

	itVariant('symbol')('removes the selected type without clearing direct conditions', () => {
		// Arrange:
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';
		const { onChange } = renderFilter({ types: 'TRANSFER', from: address });

		// Act:
		fireEvent.click(screen.getByLabelText('Remove filter_type'));

		// Assert:
		expect(onChange).toHaveBeenCalledWith({ from: address });
	});

	itVariant('symbol')('clicks the shared close control without applying the draft', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange } = renderFilter();
		const dialog = openField('filter_from');

		// Act:
		await user.type(within(dialog).getByRole('textbox'), 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y');
		fireEvent.click(within(dialog).getByAltText('Close'));

		// Assert:
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	itVariant('symbol')('does not open direct filters while disabled', () => {
		// Arrange:
		renderFilter({}, jest.fn(), jest.fn(), true);
		const fromButton = screen.getByRole('button', { name: 'filter_from' });

		// Act:
		fireEvent.click(fromButton);

		// Assert:
		expect(fromButton).toHaveAttribute('aria-disabled', 'true');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	itVariant('symbol')('does not apply a draft when disabled after opening the dialog', async () => {
		// Arrange:
		const user = userEvent.setup();
		const { onChange, rerender } = renderFilter();
		const dialog = openField('filter_from');
		const input = within(dialog).getByRole('textbox');
		const address = 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y';
		await user.type(input, address);
		rerender(<TransactionFilter
			isSelectedItemsShown
			data={fields}
			value={{}}
			isDisabled
			onChange={onChange}
			onClear={jest.fn()}
			search={jest.fn()}
		/>);

		// Act:
		await user.keyboard('{Enter}');

		// Assert:
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});
