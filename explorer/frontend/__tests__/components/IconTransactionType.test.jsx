import IconTransactionType from '@/components/IconTransactionType';
import { TRANSACTION_TYPE } from '@/constants';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/CustomImage', () => {
	const CustomImageMock = props => <div data-testid="transaction-type-icon" data-src={props.src} />;

	return CustomImageMock;
});

describe('IconTransactionType', () => {
	it('uses namespace icon for address alias transactions', () => {
		// Act:
		render(<IconTransactionType value={TRANSACTION_TYPE.ADDRESS_ALIAS} />);

		// Assert:
		expect(screen.getByTestId('transaction-type-icon')).toHaveAttribute('data-src', '/images/transaction/namespace.svg');
	});

	it('uses account multisig icon for multisig account modification transactions', () => {
		// Act:
		render(<IconTransactionType value={TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION} />);

		// Assert:
		expect(screen.getByTestId('transaction-type-icon')).toHaveAttribute('data-src', '/images/transaction/account-multisig.svg');
	});
});
