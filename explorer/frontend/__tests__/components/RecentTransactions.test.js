import '@testing-library/jest-dom';
import RecentTransactions from '@/app/components/RecentTransactions';
import { TRANSACTION_TYPE } from '@/app/constants';
import { render, screen } from '@testing-library/react';

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
		const data = [{ ...baseTransaction, type }];

		// Act:
		render(<RecentTransactions data={data} blockTime={blockTime} group="unconfirmed" />);

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
});
