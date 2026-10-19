import '@testing-library/jest-dom';
import { itVariant } from '../test-utils/variants';
import ItemTransactionMobile from '@/app/components/ItemTransactionMobile';
import ValueTransactionType from '@/app/components/ValueTransactionType';
import { render, screen } from '@testing-library/react';

let mockLanguage = 'en';

jest.mock('next-i18next', () => ({
	useTranslation: () => ({
		t: key => key,
		i18n: { language: mockLanguage }
	})
}));

const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

const transactionForMobileRow = type => ({
	hash: 'transaction-hash',
	sender: '',
	recipient: '',
	value: [],
	type,
	timestamp: 123456,
	direction: null
});

const renderTransactionTypes = type => (
	<>
		<ValueTransactionType value={type} />
		<ItemTransactionMobile data={transactionForMobileRow(type)} isTimestampShown={false} />
	</>
);

describe('transaction type displays', () => {
	itVariant('nem')('keeps the existing translated label and icon when Symbol helpers are absent', () => {
		mockLanguage = 'en';
		render(renderTransactionTypes('TRANSFER'));

		expect(screen.getAllByText('transactionType_TRANSFER')).toHaveLength(2);
		const icons = screen.getAllByAltText('TRANSFER');
		expect(icons).toHaveLength(2);
		icons.forEach(icon => expect(getIconPath(icon)).toContain('/nem/images/transaction/transfer.svg'));
	});

	itVariant('symbol')('uses Symbol labels and updates when the active display language changes', () => {
		mockLanguage = 'en';
		const type = 'AGGREGATE_COMPLETE';
		const { rerender } = render(renderTransactionTypes(type));

		expect(screen.getAllByText('Aggregate Complete')).toHaveLength(2);
		mockLanguage = 'ja';
		rerender(renderTransactionTypes(type));
		expect(screen.getAllByText('アグリゲートコンプリート')).toHaveLength(2);
		expect(screen.queryByText('Aggregate Complete')).not.toBeInTheDocument();

		const icons = screen.getAllByAltText(type);
		expect(icons).toHaveLength(2);
		icons.forEach(icon => expect(getIconPath(icon)).toContain('/symbol/images/transaction/aggregate.svg'));
	});
});
