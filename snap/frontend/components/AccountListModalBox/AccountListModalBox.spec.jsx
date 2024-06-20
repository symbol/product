import AccountListModalBox from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

describe('components/AccountListModalBox', () => {
	it('renders account list', () => {
		// Arrange:
		const numberOfAccounts = 2;
		const accounts = testHelper.generateAccountsState(numberOfAccounts);

		testHelper.customRender(<AccountListModalBox accounts={accounts} isOpen={true} onRequestClose={jest.fn()} />, {});

		for (let index = 0; index < numberOfAccounts; index++) {
			// Act:
			const accountLabel = screen.getByText('Wallet 0');
			const accountAddress = screen.getByText('Address 0');

			// Assert:
			expect(accountLabel).toBeInTheDocument();
			expect(accountAddress).toBeInTheDocument();
		}
	});
});
