import '@testing-library/jest-dom';
import TransactionGraphic from '@/app/components/TransactionGraphic';
import { MESSAGE_TYPE, TRANSACTION_TYPE } from '@/app/constants';
import { render, screen } from '@testing-library/react';

describe('components/TransactionGraphic', () => {
	const createTransferTransaction = message => ({
		type: TRANSACTION_TYPE.TRANSFER,
		sender: 'NCDZDXLTPSSHGWDGBWCNC67GDM7VU6ZQM4KJLXWZ',
		recipient: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV',
		message
	});

	const runMessageTest = (message, expectedFieldTitle) => {
		// Arrange:
		const transactions = [createTransferTransaction(message)];

		// Act:
		render(<TransactionGraphic transactions={transactions} />);

		// Assert:
		expect(screen.getByText(expectedFieldTitle)).toBeInTheDocument();
		expect(screen.getByText(message.text)).toBeInTheDocument();
	};

	it('renders plain message text with the generic message field title', () => {
		runMessageTest({ type: MESSAGE_TYPE.PLAIN, text: 'Hello NEM' }, 'field_message');
	});

	it('renders raw message text with the generic message field title', () => {
		runMessageTest({ type: MESSAGE_TYPE.RAW, text: 'HEX: ABCD1234' }, 'field_message');
	});

	it('renders encrypted message text with the encrypted message field title', () => {
		runMessageTest({ type: MESSAGE_TYPE.ENCRYPTED, text: 'A1B2C3D4' }, 'field_messageEncrypted');
	});

	it('renders no message field when the transaction has no message', () => {
		// Arrange:
		const transactions = [createTransferTransaction(null)];

		// Act:
		render(<TransactionGraphic transactions={transactions} />);

		// Assert:
		expect(screen.queryByText('field_message')).not.toBeInTheDocument();
		expect(screen.queryByText('field_messageEncrypted')).not.toBeInTheDocument();
	});
});
