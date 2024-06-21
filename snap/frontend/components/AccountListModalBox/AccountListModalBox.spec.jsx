import AccountListModalBox from '.';
import testHelper from '../testHelper';
import { fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setSelectedAccount: jest.fn()
	},
	walletState: {
		selectedAccount: {
			address: 'address 1',
			label: 'wallet 1'
		},
		accounts: {}
	}
};

describe('components/AccountListModalBox', () => {
	it('renders account list', () => {
		// Arrange:
		const numberOfAccounts = 2;
		context.walletState.accounts = testHelper.generateAccountsState(numberOfAccounts);

		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		for (let index = 0; index < numberOfAccounts; index++) {
			// Act:
			const accountLabel = screen.getByText('Wallet 0');
			const accountAddress = screen.getByText('Address 0');

			// Assert:
			expect(accountLabel).toBeInTheDocument();
			expect(accountAddress).toBeInTheDocument();
		}
	});

	it('dispatch selects account when click on address', () => {
		// Arrange:
		const numberOfAccounts = 2;
		context.walletState.accounts = testHelper.generateAccountsState(numberOfAccounts);

		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		// Act:
		const accountAddress = screen.getByText('Address 1');
		fireEvent.click(accountAddress);

		// Assert:
		expect(context.dispatch.setSelectedAccount).toHaveBeenCalledWith(Object.values(context.walletState.accounts)[1]);
	});

	it('renders account create modal box when click on create button', () => {
		// Arrange:
		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		const createButton = screen.getByText('Create');

		// Act:
		fireEvent.click(createButton);

		// Assert:
		const createWalletScreen = screen.getByText('Create Wallet');
		expect(createWalletScreen).toBeInTheDocument();
	});
});
