import AccountListModalBox from '.';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setSelectedAccount: jest.fn(),
		updateAccount: jest.fn()
	},
	symbolSnap: {
		renameAccountLabel: jest.fn()
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
			const accountLabel = screen.getByText(`Account ${index}`);
			const accountAddress = screen.getByText(`Address ${index}`);
			const accountIcons = screen.queryAllByAltText('account-profile');

			// Assert:
			expect(accountLabel).toBeInTheDocument();
			expect(accountAddress).toBeInTheDocument();
			expect(accountIcons.length).toBe(2);
		}
	});

	it('renders import type account list', () => {
		// Arrange:
		const numberOfAccounts = 2;
		context.walletState.accounts = testHelper.generateAccountsState(numberOfAccounts, 'import');

		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		for (let index = 0; index < numberOfAccounts; index++) {
			// Act:
			const importLabel = screen.getByText(`Account ${index} (import)`);

			// Assert:
			expect(importLabel).toBeInTheDocument();
		}
	});

	it('dispatch selects account when click on address', () => {
		// Arrange:
		const numberOfAccounts = 2;
		context.walletState.accounts = testHelper.generateAccountsState(numberOfAccounts);

		jest.spyOn(helper, 'updateAccountMosaics').mockImplementation();

		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		// Act:
		const accountAddress = screen.getByText('Address 1');
		fireEvent.click(accountAddress);

		// Assert:
		expect(helper.updateAccountMosaics).toHaveBeenCalledWith(context.dispatch, context.symbolSnap, 'accountId 1');
	});

	const assertErrorValidation = (buttonName, inputBox, inputValue, expectedErrorMessage) => {
		// Arrange:
		testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		const button = screen.getByText(buttonName);
		fireEvent.click(button);

		const inputComponent = screen.getByPlaceholderText(inputBox);
		fireEvent.change(inputComponent, { target: { value: inputValue } });

		const submitButton = screen.getByText('Submit');

		// Act:
		fireEvent.click(submitButton);

		// Assert:
		const error = screen.getByText(expectedErrorMessage);
		expect(error).toBeInTheDocument();
	};

	const runBasicValidationAccountNameInput = (buttonName, placeholderName) => {
		it('can validate account name is required', () => {
			assertErrorValidation(buttonName, placeholderName, ' ', 'Account name is required');
		});

		it('can validate account name is exist', () => {
			// Arrange:
			context.walletState.accounts = testHelper.generateAccountsState(1);

			assertErrorValidation(buttonName, placeholderName, 'Account 0', 'Account name already exists');
		});
	};

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
			runBasicValidationAccountNameInput('Create', 'Account Name');
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

	describe('import account modal box', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('renders account import form', () => {
			// Arrange:
			testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

			const importButton = screen.getByText('Import');
			fireEvent.click(importButton);

			// Act:
			const accountNameInput = screen.getByPlaceholderText('Account Name');
			const privateKeyInput = screen.getByPlaceholderText('Private Key');

			// Assert:
			expect(accountNameInput).toBeInTheDocument();
			expect(privateKeyInput).toBeInTheDocument();
		});

		describe('validation', () => {
			runBasicValidationAccountNameInput('Import', 'Account Name');

			it('can validate private key is invalid', () => {
				assertErrorValidation('Import', 'Private Key', 'invalid private key', 'Invalid private key');
			});
		});

		describe('submit', () => {
			// Arrange:
			const privateKey = '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010';

			const assertSubmit = (accountName, privateKey, expectedResult) => {
				// Arrange:
				jest.spyOn(helper, 'importAccount').mockImplementation();

				testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				const buttonComponent = screen.getByText('Import');
				fireEvent.click(buttonComponent);

				const accountNameInput = screen.getByPlaceholderText('Account Name');
				const privateKeyInput = screen.getByPlaceholderText('Private Key');
				fireEvent.change(accountNameInput, { target: { value: accountName } });
				fireEvent.change(privateKeyInput, { target: { value: privateKey } });

				const submitButton = screen.getByText('Submit');

				// Act:
				fireEvent.click(submitButton);

				// Assert:
				if (expectedResult) {
					expect(helper.importAccount).toHaveBeenCalledWith(
						context.dispatch,
						context.symbolSnap,
						context.walletState.accounts,
						accountName,
						privateKey
					);
				} else {
					expect(helper.importAccount).not.toHaveBeenCalled();
				}
			};

			it('can import account with valid data', () => {
				assertSubmit('import 1', privateKey, true);
			});

			it('does not import account with invalid account name', () => {
				assertSubmit(' ', privateKey, false);
			});

			it('does not import account with invalid private key', () => {
				assertSubmit('import 1', '', false);
			});
		});
	});

	describe('rename account modal box', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});
		
		it('renders modal box', () => {
			// Arrange:
			context.walletState.accounts = testHelper.generateAccountsState(1);

			testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

			// Act:
			const renameButton = screen.getByText('Rename');
			fireEvent.click(renameButton);

			// Assert:
			const accountNameInput = screen.getByPlaceholderText('New Account Name');
			expect(accountNameInput).toBeInTheDocument();
		});

		describe('validation', () => {
			runBasicValidationAccountNameInput('Rename', 'New Account Name');
		});

		describe('submit', () => {
			const assertSubmit = (accountName, expectedResult) => {
				// Arrange:
				jest.spyOn(helper, 'renameAccountLabel').mockImplementation();

				testHelper.customRender(<AccountListModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				const buttonComponent = screen.getByText('Rename');
				fireEvent.click(buttonComponent);

				const accountNameInput = screen.getByPlaceholderText('New Account Name');
				fireEvent.change(accountNameInput, { target: { value: accountName } });

				const submitButton = screen.getByText('Submit');

				// Act:
				fireEvent.click(submitButton);

				// Assert:
				if (expectedResult) {
					expect(helper.renameAccountLabel).toHaveBeenCalledWith(
						context.dispatch,
						context.symbolSnap,
						'accountId 0',
						accountName
					);
				} else {
					expect(helper.renameAccountLabel).not.toHaveBeenCalled();
				}
			};

			it('can rename account with valid data', () => {
				assertSubmit('new name', true);
			});

			it('does not rename account with invalid account name', () => {
				assertSubmit(' ', false);
			});

		});
	});
});
