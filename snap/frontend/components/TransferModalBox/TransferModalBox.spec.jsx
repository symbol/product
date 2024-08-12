import TransferModalBox from '.';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

const context = {
	walletState: {
		selectedAccount: {
			id: 'accountId',
			address: 'address 1',
			label: 'wallet 1',
			mosaics: []
		},
		network: {
			networkName: 'testnet',
			currencyMosaicId: 'mosaicId'
		},
		mosaicInfo: {
			mosaicId: {
				divisibility: 6,
				name: ['symbol.xym']
			},
			mosaicId2: {
				divisibility: 2,
				name: []
			}
		}
	},
	symbolSnap: {
		getFeeMultiplier: jest.fn(),
		signTransferTransaction: jest.fn()
	},
	dispatch: {
		setLoadingStatus: jest.fn()
	}
};

describe('components/TransferModalBox', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		context.walletState.selectedAccount.mosaics = [];
	});

	it('renders transfer form in modal box', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: 'mosaicId',
				amount: 100
			}
		];

		testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

		// Act:
		const form = screen.getByRole('transfer-form');
		const ReceiverAddress = screen.getByRole('address-input');
		const mosaicSelector = screen.getByRole('mosaic-selector');
		const messageInput = screen.getByRole('message-input');
		const messageCheckbox = screen.getByRole('message-checkbox');

		// Assert:
		expect(form).toBeInTheDocument();
		expect(ReceiverAddress).toBeInTheDocument();
		expect(mosaicSelector).toBeInTheDocument();
		expect(messageInput).toBeInTheDocument();
		expect(messageCheckbox).toBeInTheDocument();
	});

	it('renders fee multiplier components', async () => {
		// Arrange:
		context.symbolSnap.getFeeMultiplier.mockResolvedValue({
			slow: 10,
			average: 100,
			fast: 1000
		});

		// Act:
		await act(() => testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context));

		// Assert:
		await waitFor(() => {
			expect(screen.getByLabelText('SLOW')).toBeInTheDocument();
			expect(screen.getByLabelText('AVERAGE')).toBeInTheDocument();
			expect(screen.getByLabelText('FAST')).toBeInTheDocument();
		});
	});

	describe('form validation', () => {
		const assertValidateInputError = (inputComponentPlaceholderText, inputValue, expectedError) => {
			// Arrange:
			testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
			const inputComponent = screen.getByPlaceholderText(inputComponentPlaceholderText);

			// Act:
			fireEvent.change(inputComponent, { target: { value: inputValue } });

			// Assert:
			const error = screen.getByText(expectedError);
			expect(error).toBeInTheDocument();

			// Reset input value
			fireEvent.change(inputComponent, { target: { value: '' } });
		};

		it('renders error when address not validate', () => {
			assertValidateInputError('Recipient address', 'abc', 'Invalid address');
		});

		it('renders error when address different network', () => {
			assertValidateInputError('Recipient address', 'NDSW2TML6QR6CXY5KOYDJ5MCQTXLTMXT5AOR2PY', 'Invalid address');
		});

		it('renders error when message length more than 1024', () => {
			assertValidateInputError('Message...', '0'.repeat(1025), 'Message length should not exceed 1024 characters');
		});

		it('renders error when input balance (relative) is higher then account balance', () => {
			context.walletState.selectedAccount.mosaics = [
				{
					id: 'mosaicId',
					amount: 1000000
				}
			];

			assertValidateInputError('relative amount', '1.1' , 'Not enough balance');
		});

		it('does not render errors if data in valid' , () => {
			// Arrange:
			context.walletState.selectedAccount.mosaics = [
				{
					id: 'mosaicId',
					amount: 1000000
				}
			];

			testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
			const addressInput = screen.getByPlaceholderText('Recipient address');
			const amountInput = screen.getByPlaceholderText('relative amount');
			const messageInput = screen.getByPlaceholderText('Message...');

			// Act:
			fireEvent.change(addressInput, { target: { value: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y' } });
			fireEvent.change(amountInput, { target: { value: 0.5 } });
			fireEvent.change(messageInput, { target: { value: 'hello world' } });

			// Assert:
			const errors = [
				screen.queryByText('Invalid address'),
				screen.queryByText('Message length should not exceed 1024 characters'),
				screen.queryByText('Not enough balance')
			];

			errors.forEach(error => {
				expect(error).toBeNull();
			});
		});
	});

	describe('mosaic selector', () => {
		beforeEach(() => {
			context.walletState.selectedAccount.mosaics = [
				{
					id: 'mosaicId',
					amount: 1000000
				},
				{
					id: 'mosaicId2',
					amount: 100
				}
			];
		});

		describe('add mosaic', () => {
			it('renders Add button if own more than one mosaic', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				// Act:
				const addMosaicButton = screen.getByText('Add');

				// Assert:
				expect(addMosaicButton).toBeInTheDocument();
			});

			it('click on Add button should add new mosaic selector', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
				const addMosaicButton = screen.getByText('Add');

				// Act:
				fireEvent.click(addMosaicButton);

				// Assert:
				const mosaicSelector = screen.getAllByRole('mosaic-selector');
				expect(mosaicSelector).toHaveLength(2);
			});

			it('does not render Add button if own only one mosaic', () => {
				// Arrange:
				context.walletState.selectedAccount.mosaics = [
					{
						id: 'mosaicId',
						amount: 1000000
					}
				];

				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				// Act:
				const addMosaicButton = screen.queryByText('Add');

				// Assert:
				expect(addMosaicButton).toBeNull();
			});
		});

		describe('remove mosaic', () => {
			it('renders Remove button if exist multiple mosaic selector', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
				const addMosaicButton = screen.getByText('Add');
				fireEvent.click(addMosaicButton);

				// Act:
				const removeMosaicButton = screen.getByText('Remove');

				// Assert:
				expect(removeMosaicButton).toBeInTheDocument();
			});

			it('click on Remove button should remove last mosaic selector', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
				const addMosaicButton = screen.getByText('Add');
				fireEvent.click(addMosaicButton);

				// Act:
				const removeMosaicButton = screen.getByText('Remove');
				fireEvent.click(removeMosaicButton);

				// Assert:
				const mosaicSelector = screen.getAllByRole('mosaic-selector');
				expect(mosaicSelector).toHaveLength(1);
			});
		});

		describe('mosaic selector options', () => {
			it('renders options contain all mosaics that account own', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				// Act:
				const mosaicSelector = screen.getAllByRole('mosaic-selector');
				const options = mosaicSelector[0].querySelectorAll('option');

				// Assert:
				expect(options).toHaveLength(2);
				expect(options[0].value).toEqual('mosaicId');
				expect(options[1].value).toEqual('mosaicId2');
			});

			it('renders selector options should not contain mosaic that already selected', () => {
				// Arrange:
				testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);

				const addMosaicButton = screen.getByText('Add');
				fireEvent.click(addMosaicButton);

				// Act:
				const mosaicSelector = screen.getAllByRole('mosaic-selector');
				const options1 = mosaicSelector[0].querySelectorAll('option');
				const options2 = mosaicSelector[1].querySelectorAll('option');

				// Assert:
				expect(options1).toHaveLength(1);
				expect(options1[0].value).toEqual('mosaicId');
				expect(options2).toHaveLength(1);
				expect(options2[0].value).toEqual('mosaicId2');
			});
		});

		it('click on max button should set amount to max balance', () => {
			// Arrange:
			context.walletState.selectedAccount.mosaics = [
				{
					id: 'mosaicId',
					amount: 1000000
				}
			];

			testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
			const amountInput = screen.getByPlaceholderText('relative amount');

			// Act:
			fireEvent.click(screen.getByText('Max'));

			// Assert:
			expect(amountInput).toHaveValue(1);
		});
	});

	describe('send transaction', () => {
		beforeEach(() => {
			context.symbolSnap.getFeeMultiplier.mockResolvedValue({
				slow: 10,
				average: 100,
				fast: 1000
			});

			context.walletState.selectedAccount.mosaics = [
				{
					id: 'mosaicId',
					amount: 1000000
				}
			];
		});

		const assertInvalidForm = async (inputComponentPlaceholderText, inputValue) => {
			// Arrange:
			testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={jest.fn()} />, context);
			const inputComponent = screen.getByPlaceholderText(inputComponentPlaceholderText);

			await waitFor(() => fireEvent.change(inputComponent, { target: { value: inputValue } }));

			jest.spyOn(helper, 'signTransferTransaction');

			// Act:
			await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /send/i })));

			// Assert:
			expect(helper.signTransferTransaction).not.toHaveBeenCalled();

			// Reset input value
			fireEvent.change(inputComponent, { target: { value: '' } });
		};

		it('does not invoke sendTransaction if form not valid (address input)', async () => {
			await assertInvalidForm('Recipient address', 'abc');
		});

		it('does not invoke sendTransaction if form not valid (message input)', async () => {
			await assertInvalidForm('Message...', '0'.repeat(1025));
		});

		it('does not invoke sendTransaction if form not valid (amount input)', async () => {
			await assertInvalidForm('relative amount', '1.1' );
		});

		const assertValidateForm = async (mockSignResult, expectedResult) => {
			// Arrange:
			const mockOnRequestClose = jest.fn();

			testHelper.customRender(<TransferModalBox isOpen={true} onRequestClose={mockOnRequestClose} />, context);
			const addressInput = screen.getByPlaceholderText('Recipient address');
			const amountInput = screen.getByPlaceholderText('relative amount');
			const messageInput = screen.getByPlaceholderText('Message...');

			fireEvent.change(addressInput, { target: { value: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y' } });
			fireEvent.change(amountInput, { target: { value: 0.5 } });
			fireEvent.change(messageInput, { target: { value: 'hello world' } });

			jest.spyOn(helper, 'signTransferTransaction').mockResolvedValue(mockSignResult);

			// Act:
			await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /send/i })));

			// Assert:
			expect(helper.signTransferTransaction).toHaveBeenCalledWith(
				context.dispatch,
				context.symbolSnap,
				{
					accountId: 'accountId',
					recipient: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
					mosaics: [
						{
							id: 'mosaicId',
							amount: 0.5
						}
					],
					message: 'hello world',
					feeMultiplierType: 'slow'
				}
			);

			if (expectedResult) 
				expect(mockOnRequestClose).toHaveBeenCalled();
			 else 
				expect(mockOnRequestClose).not.toHaveBeenCalled();
			
		};

		it('does not close modal box when result return false', async () => {
			await assertValidateForm(false, false);
		});

		it('close modal box when result return transaction hash', async () => {
			await assertValidateForm('hash', true);
		});
	});
});
