import '@testing-library/jest-dom';
import { itVariant } from '../test-utils/variants';
import RecentTransactions from '@/app/components/RecentTransactions';
import { TRANSACTION_GROUP, TRANSACTION_TYPE } from '@/app/constants';
import { SYMBOL_TRANSACTION_TYPE } from '@/app/variants/symbol/constants';
import { render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

TimeAgo.addDefaultLocale(en);

const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

jest.mock('next/router', () => ({
	useRouter: () => ({ locale: 'en' })
}));

describe('components/RecentTransactions', () => {
	const blockTime = 30;
	const baseTransaction = {
		signer: 'NBTESTADDRESS',
		hash: 'transaction-hash',
		timestamp: 123456,
		amount: 1000
	};

	const runUnconfirmedTest = (type, expectedStatusText, unexpectedStatusText) => {
		// Arrange:
		const data = [{ ...baseTransaction, type, group: TRANSACTION_GROUP.UNCONFIRMED }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} />);

		// Assert:
		expect(screen.getByText(expectedStatusText)).toBeInTheDocument();
		if (unexpectedStatusText)
			expect(screen.queryByText(unexpectedStatusText)).not.toBeInTheDocument();
	};

	it('shows confirmation estimate for unconfirmed transfer transactions', () => {
		const expectedStatusText = `value_transactionConfirmationTime::value:${blockTime}`;

		runUnconfirmedTest(TRANSACTION_TYPE.TRANSFER, expectedStatusText, 'label_awaitingCosignatures');
	});

	itVariant('nem')('shows awaiting cosignatures label for unconfirmed multisig transactions', () => {
		runUnconfirmedTest(TRANSACTION_TYPE.MULTISIG, 'label_awaitingCosignatures', /value_transactionConfirmationTime/);
	});

	it('shows no pending status for confirmed transactions', () => {
		// Arrange:
		const data = [{ ...baseTransaction, type: TRANSACTION_TYPE.MULTISIG, group: TRANSACTION_GROUP.CONFIRMED }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} />);

		// Assert:
		expect(screen.queryByText(/value_transactionConfirmationTime/)).not.toBeInTheDocument();
		expect(screen.queryByText('label_awaitingCosignatures')).not.toBeInTheDocument();
	});

	itVariant('nem')('keeps the existing label and icon when Symbol display helpers are absent', () => {
		// Arrange:
		const type = TRANSACTION_TYPE.TRANSFER;
		const data = [{ ...baseTransaction, type, group: TRANSACTION_GROUP.CONFIRMED }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} />);

		// Assert:
		expect(screen.getByText(`transactionType_${type}`)).toBeInTheDocument();
		expect(getIconPath(screen.getByAltText(type))).toContain('/nem/images/transaction/transfer.svg');
	});

	itVariant('symbol')('uses Symbol labels and icons in the transaction preview', () => {
		// Arrange:
		const type = SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE;
		const data = [{ ...baseTransaction, type, group: TRANSACTION_GROUP.CONFIRMED }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} />);

		// Assert:
		expect(screen.getByText('Aggregate Complete')).toBeInTheDocument();
		expect(getIconPath(screen.getByAltText(type))).toContain('/symbol/images/transaction/aggregate.svg');
	});
});
