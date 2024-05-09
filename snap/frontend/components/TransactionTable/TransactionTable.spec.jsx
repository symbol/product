import TransactionTable from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const senderAddress = 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI';
const recipientAddress = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';

const context = {
	dispatch: jest.fn(),
	walletState: {
		selectedAccount: {
			address: senderAddress
		},
		finalizedHeight: 10,
		transactions: []
	}
};

describe('components/TransactionTable', () => {
	it('renders no transactions found message when transactions are empty', () => {
		// Arrange:

		testHelper.customRender(<TransactionTable />, context);

		// Act:
		const transactionTable = screen.getByText('No transactions found');

		// Assert:
		expect(transactionTable).toBeInTheDocument();
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
					sender: senderAddress
				},
				'Send logo'
			);
		});

		it('renders receive icon when sender is not the same as selected account', () => {
			assertIcon(
				{
					sender: recipientAddress
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

		it('renders transaction type as Sent when sender is the same as selected account', () => {
			assertTransactionType({
				sender: senderAddress,
				transactionType: 'Transfer'
			}, 'Sent');
		});

		it('renders transaction type as Received when sender is not the same as selected account', () => {
			assertTransactionType({
				sender: recipientAddress,
				transactionType: 'Transfer'
			}, 'Received');
		});

		it('renders transaction type as transaction type when not Transfer', () => {
			assertTransactionType({
				sender: recipientAddress,
				transactionType: 'Aggregate Bonded'
			}, 'Aggregate Bonded');
		});

		describe('transaction status', () => {
			const assertTransactionStatus = (transaction, expectedTransactionStatus) => {
				// Arrange:
				context.walletState.transactions = [transaction];

				testHelper.customRender(<TransactionTable />, context);

				// Act:
				const transactionStatus = screen.getByText(expectedTransactionStatus);

				// Assert:
				expect(transactionStatus).toBeInTheDocument();
			};

			it('renders transaction as Confirmed when height is not null', () => {
				assertTransactionStatus({
					height: 1
				}, 'Confirmed');
			});

			it('renders transaction as Pending when height is null', () => {
				assertTransactionStatus({
					height: null
				}, 'Pending');
			});
		});
	});

	describe('third column', () => {
		it('renders transaction amount when amount is not null', () => {
			// Arrange:
			context.walletState.transactions = [{
				amount: 100
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
				assertFinalizedIcon(10, 10, true);
			});

			it('renders finalized icon when transaction height is greater than finalized height', () => {
				assertFinalizedIcon(5, 10, true);
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

		it('renders transaction height and date', () => {
			// Arrange:
			context.walletState.transactions = [{
				height: 1,
				date: '2021-07-07'
			}];

			testHelper.customRender(<TransactionTable />, context);

			// Act:
			const height = screen.getByText('1');
			const date = screen.getByText('2021-07-07');

			// Assert:
			expect(height).toBeInTheDocument();
			expect(date).toBeInTheDocument();
		});
	});
});
