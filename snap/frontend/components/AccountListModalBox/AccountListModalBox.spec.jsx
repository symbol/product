import AccountListModalBox from '.';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setSelectedAccount: jest.fn()
	},
	symbolSnap: {},
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
			const accountLabel = screen.getByText('Account 0');
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
		const createAccountScreen = screen.getByText('Create Account');
		expect(createAccountScreen).toBeInTheDocument();
	});

	describe('create account modal box', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('renders account create form', () => {
			// Arrange:
			testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

			const createButton = screen.getByText('Create');
			fireEvent.click(createButton);

			// Act:
			const accountNameInput = screen.getByPlaceholderText('Account Name');

			// Assert:
			expect(accountNameInput).toBeInTheDocument();
		});

		describe('validation', () => {
			const assertValidation = (accountName, expectedErrorMessage) => {
				// Arrange:
				testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				const createButton = screen.getByText('Create');
				fireEvent.click(createButton);

				const accountNameInput = screen.getByPlaceholderText('Account Name');
				fireEvent.change(accountNameInput, { target: { value: accountName } });

				const submitButton = screen.getByText('Submit');

				// Act:
				fireEvent.click(submitButton);

				// Assert:
				const accountNameError = screen.getByText(expectedErrorMessage);
				expect(accountNameError).toBeInTheDocument();
			};

			it('can validate account name is required', () => {
				assertValidation(' ', 'Account name is required');
			});

			it('can validate account name is exist', () => {
				// Arrange:
				context.walletState.accounts = {
					'0x1234': {
						address: 'address 1',
						label: 'wallet 1'
					}
				};

				assertValidation('wallet 1', 'Account name already exists');
			});
		});

		describe('submit', () => {
			jest.spyOn(helper, 'createNewAccount').mockImplementation();

			const assertSubmit = (accountName, expectedResult) => {
				// Arrange:
				testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				const createButton = screen.getByText('Create');
				fireEvent.click(createButton);

				const accountNameInput = screen.getByPlaceholderText('Account Name');
				fireEvent.change(accountNameInput, { target: { value: accountName } });

				const submitButton = screen.getByText('Submit');

				// Act:
				fireEvent.click(submitButton);

				// Assert:
				if (expectedResult) {
					expect(helper.createNewAccount).toHaveBeenCalledWith(
						context.dispatch,
						context.symbolSnap,
						context.walletState.accounts,
						accountName
					);
				} else {
					expect(helper.createNewAccount).not.toHaveBeenCalled();
				}
			};

			it('can create account with valid data', () => {
				assertSubmit('wallet 2', true);
			});

			it('does not create account with invalid data', () => {
				assertSubmit(' ', false);
			});
		});
	});
});
