import TransactionTable from '.';
import { Channels } from '../../config';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { expect, jest } from '@jest/globals';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';

const senderAddress = 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI';
const recipientAddress = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';

const context = {
	dispatch: {
		setTransactions: jest.fn(),
		setMosaicInfo: jest.fn(),
		setSelectedAccount: jest.fn()
	},
	walletState: {
		selectedAccount: {
			address: senderAddress
		},
		finalizedHeight: 10,
		transactions: [],
		mosaicInfo: {
			mosaicId: {
				divisibility: 6
			}
		},
		network: {
			currencyMosaicId: 'mosaicId',
			networkName: 'testnet'
		},
		currency: {
			symbol: 'USD',
			price: 1
		},
		websocket: {
			listenConfirmedTransaction: jest.fn((callback, address) => callback()),
			listenUnconfirmedTransaction: jest.fn((callback, address) => callback()),
			removeSubscriber: jest.fn()
		}
	},
	symbolSnap: {
		fetchAccountTransactions: jest.fn(),
		fetchAccountMosaics : jest.fn(),
		getMosaicInfo: jest.fn()
	}
};

describe('components/TransactionTable', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		context.symbolSnap.fetchAccountMosaics.mockReturnValue({
			'account1': {
				id: 'account1',
				addressIndex: 1,
				type: 'metamask',
				networkName: 'network',
				label: 'label',
				address: 'address',
				publicKey: 'publicKey'
			}
		});
	});

	it('renders no transactions found message when transactions are empty', () => {
		// Arrange:
		context.symbolSnap.fetchAccountTransactions.mockReturnValue([]);

		testHelper.customRender(<TransactionTable />, context);

		// Act:
		const transactionTable = screen.getByText('No transactions found');

		// Assert:
		expect(transactionTable).toBeInTheDocument();
		expect(context.symbolSnap.fetchAccountTransactions).toHaveBeenCalledTimes(5);
	});

	it('renders loading more transactions when in view', () => {
		// Arrange:
		context.walletState.transactions = [{
			id: 1
		}];
		context.symbolSnap.fetchAccountTransactions.mockReturnValue([]);

		testHelper.customRender(<TransactionTable />, context);

		// Act:
		const transactionTable = screen.getByText('Loading more...');

		// Assert:
		expect(transactionTable).toBeInTheDocument();
		expect(context.symbolSnap.fetchAccountTransactions).toHaveBeenCalledTimes(5);
	});

	it('update transactions when address change', async () => {
		// Arrange:
		jest.spyOn(helper, 'updateTransactions').mockResolvedValue();
		jest.spyOn(toast, 'success');

		// context.symbolSnap.fetchAccountTransactions.mockReturnValue([]);

		testHelper.customRender(<TransactionTable />, context);

		// Act:
		cleanup();

		// Assert:
		await waitFor(() => {
			expect(helper.updateTransactions).toHaveBeenCalledWith(context.dispatch, context.symbolSnap, senderAddress);
			expect(toast.success).toHaveBeenNthCalledWith(1, 'New confirmed transaction');
			expect(context.walletState.websocket.listenConfirmedTransaction).toHaveBeenCalledWith(
				expect.any(Function),
				senderAddress
			);
			expect(context.walletState.websocket.listenUnconfirmedTransaction).toHaveBeenCalledWith(
				expect.any(Function),
				senderAddress
			);
			expect(toast.success).toHaveBeenNthCalledWith(2, 'New pending transaction');
			expect(context.walletState.websocket.removeSubscriber).toHaveBeenCalledWith(`${Channels.confirmedAdded}/${senderAddress}`);
			expect(context.walletState.websocket.removeSubscriber).toHaveBeenCalledWith(`${Channels.unconfirmedAdded}/${senderAddress}`);
		});
	});

	describe('first column', () => {
		const assertIcon = (transaction, expectedIcon) => {
			// Arrange:
			context.walletState.transactions = [transaction];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const icon = screen.getByAltText(expectedIcon);

			// Assert:
			expect(icon).toBeInTheDocument();
		};

		it('renders send icon when sender is the same as selected account', () => {
			assertIcon(
				{
					sender: senderAddress,
					transactionType: 'Transfer'
				},
				'Send logo'
			);
		});

		it('renders receive icon when sender is not the same as selected account', () => {
			assertIcon(
				{
					sender: recipientAddress,
					transactionType: 'Transfer'
				},
				'Receive logo'
			);
		});
	});

	describe('second column', () => {
		const assertTransactionType = (transaction, expectedTransactionType) => {
			// Arrange:
			context.walletState.transactions = [transaction];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const transactionType = screen.getByText(expectedTransactionType);

			// Assert:
			expect(transactionType).toBeInTheDocument();
		};

		it('renders as Sent when sender is the same as selected account', () => {
			assertTransactionType({
				sender: senderAddress
			}, 'Sent');
		});

		it('renders Received when sender is not the same as selected account', () => {
			assertTransactionType({
				sender: recipientAddress
			}, 'Received');
		});

		it('renders transaction type', () => {
			assertTransactionType({
				transactionType: 'Namespace Registration'
			}, 'Namespace Registration');
		});

		it('renders transaction hash with link to explorer', () => {
			// Arrange:
			context.walletState.transactions = [{
				transactionHash: '1234',
				transactionType: 'Transfer'
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const transactionType = screen.getByText('Transfer');

			// Assert:
			expect(transactionType).toBeInTheDocument();
			expect(transactionType.closest('a')).toHaveAttribute('href', 'https://testnet.symbol.fyi/transactions/1234');
		});
	});

	describe('third column', () => {
		it('renders transaction amount when amount is not null', () => {
			// Arrange:
			context.walletState.transactions = [{
				amount: 100000000
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const amount = screen.getByText('100 XYM');

			// Assert:
			expect(amount).toBeInTheDocument();
		});

		it('does not render transaction amount when amount is null', () => {
			// Arrange + Act:
			context.walletState.transactions = [{
				amount: null
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Assert:
			const amount = screen.queryByText('null XYM');
			expect(amount).not.toBeInTheDocument();
		});

		describe('message icon', () => {
			it('renders message icon when message is not null', () => {
				// Arrange:
				context.walletState.transactions = [{
					message: 'Test message'
				}];

				testHelper.customRender(<TransactionTable />, context);

				// Act:
				const messageIcon = screen.getByAltText('Message logo');

				// Assert:
				expect(messageIcon).toBeInTheDocument();
			});

			it('does not render message icon when message is null', () => {
				// Arrange + Act:
				context.walletState.transactions = [{
					message: null
				}];

				testHelper.customRender(<TransactionTable />, context);

				// Assert:
				const messageIcon = screen.queryByAltText('Message logo');
				expect(messageIcon).not.toBeInTheDocument();
			});
		});
	});

	describe('fourth column', () => {
		describe('finalized icon', () => {
			const assertFinalizedIcon = (transactionHeight, finalizedHeight) => {
				// Arrange:
				context.walletState.transactions = [{
					height: transactionHeight
				}];
				context.walletState.finalizedHeight = finalizedHeight;

				testHelper.customRender(<TransactionTable />, context);

				// Act:
				const finalizedIcon = screen.getByAltText('Finalized logo');

				// Assert:
				expect(finalizedIcon).toBeInTheDocument();
			};

			it('renders finalized icon when transaction height is equal to finalized height', () => {
				assertFinalizedIcon(10, 10);
			});

			it('renders finalized icon when transaction height is greater than finalized height', () => {
				assertFinalizedIcon(5, 10);
			});

			it('does not render finalized icon when transaction height is less than finalized height', () => {
				// Arrange:
				context.walletState.transactions = [{
					height: 15
				}];
				context.walletState.finalizedHeight = 10;

				testHelper.customRender(<TransactionTable />, context);

				// Act:
				const finalizedIcon = screen.queryByAltText('Finalized logo');

				// Assert:
				expect(finalizedIcon).not.toBeInTheDocument();
			});
		});

		it('renders transaction height, date and link to explorer', () => {
			// Arrange:
			context.walletState.transactions = [{
				height: 1,
				date: '2021-07-07 14:13:54'
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const height = screen.getByText('1');
			const date = screen.getByText('2021-07-07 14:13:54');

			// Assert:
			expect(height).toBeInTheDocument();
			expect(date).toBeInTheDocument();
			expect(height.closest('a')).toHaveAttribute('href', 'https://testnet.symbol.fyi/blocks/1');
		});

		it('renders pending when transaction height is null', () => {
			// Arrange:
			context.walletState.transactions = [{
				height: '0'
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const pending = screen.getByText('Pending');

			// Assert:
			expect(pending).toBeInTheDocument();
		});
	});
});
