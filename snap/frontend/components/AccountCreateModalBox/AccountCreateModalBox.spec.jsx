import AccountCreateModalBox from '.';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { act, fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setAccounts: jest.fn(),
		setSelectedAccount: jest.fn()
	},
	symbolSnap: {
		createAccount: jest.fn()
	},
	walletState: {
		accounts: {}
	}
};

describe('components/AccountCreateModalBox', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders AccountCreateModalBox', () => {
		// Arrange:
		testHelper.customRender(<AccountCreateModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		// Act:
		const createWalletTitle = screen.getByText('Create Wallet');
		const createButton = screen.getByText('Create');

		// Assert:
		expect(createWalletTitle).toBeInTheDocument();
		expect(createButton).toBeInTheDocument();
	});

	it('can creates new account', async () => {
		// Arrange:
		const onRequestClose = jest.fn();

		testHelper.customRender(<AccountCreateModalBox isOpen={true} onRequestClose={onRequestClose} />, context);

		const createButton = screen.getByText('Create');
		const inputElement = screen.getByPlaceholderText('Wallet Name');

		const mockNewAccount = Object.values(testHelper.generateAccountsState(1))[0];
		fireEvent.change(inputElement, { target: { value: mockNewAccount.label } });

		context.symbolSnap.createAccount.mockResolvedValue(mockNewAccount);
		jest.spyOn(helper, 'createNewAccount');

		// Act:
		await act(async () => fireEvent.click(createButton));

		// Assert:
		expect(helper.createNewAccount).toHaveBeenCalledWith(
			context.dispatch,
			context.symbolSnap,
			context.walletState.accounts,
			mockNewAccount.label
		);
		expect(inputElement.value).toBe('');
		expect(onRequestClose).toHaveBeenCalledWith(false);
	});

	it('can not creates new account when wallet name is empty', async () => {
		// Arrange:
		testHelper.customRender(<AccountCreateModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		const createButton = screen.getByText('Create');
		const inputElement = screen.getByPlaceholderText('Wallet Name');

		jest.spyOn(helper, 'createNewAccount');

		fireEvent.change(inputElement, { target: { value: '' } });

		// Act:
		await act(async () => fireEvent.click(createButton));

		// Assert:
		expect(helper.createNewAccount).not.toHaveBeenCalled();
	});

	it('can not creates new account when wallet name already exist', async () => {
		// Arrange:
		context.walletState.accounts = testHelper.generateAccountsState(1);

		testHelper.customRender(<AccountCreateModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		const createButton = screen.getByText('Create');
		const inputElement = screen.getByPlaceholderText('Wallet Name');

		jest.spyOn(helper, 'createNewAccount');

		fireEvent.change(inputElement, { target: { value: 'Wallet 0' } });

		// Act:
		await act(async () => fireEvent.click(createButton));

		// Assert:
		expect(helper.createNewAccount).not.toHaveBeenCalled();
	});

	const assertValidationError = async (input, context, expectedError) => {
		// Arrange:
		testHelper.customRender(<AccountCreateModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		const createButton = screen.getByText('Create');
		const inputElement = screen.getByPlaceholderText('Wallet Name');

		fireEvent.change(inputElement, { target: { value: input } });

		// Act:
		await act(async () => fireEvent.click(createButton));

		// Assert:
		const errorElement = screen.getByText(expectedError);
		expect(errorElement).toBeInTheDocument();
	};

	it('input box can validates wallet name already exists', async () => {
		// create default wallet
		context.walletState.accounts = testHelper.generateAccountsState(1);
		await assertValidationError('Wallet 0', context, 'Wallet name already exists');
	});

	it('input box can validates wallet name when empty', async () => {
		await assertValidationError(' ', context, 'Wallet name is required');
	});
});
