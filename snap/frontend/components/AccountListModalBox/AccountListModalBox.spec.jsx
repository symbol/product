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

	const runBasicValidationAccountNameInput = buttonName => {
		it('can validate account name is required', () => {
			assertErrorValidation(buttonName, 'Account Name', ' ', 'Account name is required');
		});

		it('can validate account name is exist', () => {
			// Arrange:
			context.walletState.accounts = {
				'0x1234': {
					address: 'address 1',
					label: 'wallet 1'
				}
			};

			assertErrorValidation(buttonName, 'Account Name', 'wallet 1', 'Account name already exists');
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
			runBasicValidationAccountNameInput('Create');
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
			runBasicValidationAccountNameInput('Import');

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
});
