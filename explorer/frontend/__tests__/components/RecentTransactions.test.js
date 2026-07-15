import '@testing-library/jest-dom';
import RecentTransactions from '@/app/components/RecentTransactions';
import { TRANSACTION_GROUP, TRANSACTION_TYPE } from '@/app/constants';
import { render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

TimeAgo.addDefaultLocale(en);

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
		runUnconfirmedTest(TRANSACTION_TYPE.TRANSFER, 'value_transactionConfirmationTime', 'label_awaitingCosignatures');
	});

	it('shows awaiting cosignatures label for unconfirmed multisig transactions', () => {
		runUnconfirmedTest(TRANSACTION_TYPE.MULTISIG, 'label_awaitingCosignatures', 'value_transactionConfirmationTime');
	});

	it('shows no pending status for confirmed transactions', () => {
		// Arrange:
		const data = [{ ...baseTransaction, type: TRANSACTION_TYPE.MULTISIG, group: TRANSACTION_GROUP.CONFIRMED }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} />);

		// Assert:
		expect(screen.queryByText('value_transactionConfirmationTime')).not.toBeInTheDocument();
		expect(screen.queryByText('label_awaitingCosignatures')).not.toBeInTheDocument();
	});
});
