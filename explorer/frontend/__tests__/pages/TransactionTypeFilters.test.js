import '@testing-library/jest-dom';
import { cosignatoryAccount } from '../../__fixtures__/local/account';
import { transactionStats } from '../../__fixtures__/local/transaction-stats';
import { toggleFilterChip } from '../test-utils/page';
import { nemTransactionTypes, symbolTransactionTypes } from '../test-utils/transaction-types';
import { activeVariant } from '../test-utils/variants';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo from '@/app/pages/accounts/[address]';
import TransactionList from '@/app/pages/transactions';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('@/app/api/transactions', () => ({
	__esModule: true,
	...jest.requireActual('@/app/api/transactions')
}));

jest.mock('@/app/api/stats', () => ({
	__esModule: true,
	...jest.requireActual('@/app/api/stats')
}));

const expectedTypes = activeVariant === 'symbol' ? symbolTransactionTypes : nemTransactionTypes;

beforeEach(() => {
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue({ data: [], pageNumber: 1 });
	jest.spyOn(TransactionService, 'fetchAccountTransactionPage').mockResolvedValue({ data: [], pageNumber: 1 });
	jest.spyOn(StatsService, 'fetchTransactionChart').mockResolvedValue([]);
	jest.spyOn(StatsService, 'fetchPriceByDate').mockResolvedValue(0.5);
});

describe.each([
	{
		name: 'Transaction list',
		requestMethod: 'fetchTransactionPage',
		renderPage: () => render(<TransactionList preloadedData={[]} stats={transactionStats} />),
		initialFilter: {}
	},
	{
		name: 'Account history',
		requestMethod: 'fetchAccountTransactionPage',
		renderPage: () => render(<AccountInfo accountInfo={cosignatoryAccount} preloadedTransactions={[]} />),
		initialFilter: { address: cosignatoryAccount.address }
	}
])('$name transaction type filter', ({ renderPage, initialFilter, requestMethod }) => {
	it('offers exactly the active variant types in the configured order', async () => {
		// Arrange:
		renderPage();

		// Act:
		await toggleFilterChip('filter_type')();

		// Assert: exact equality also excludes the NEM MULTISIG choice from Symbol.
		const icons = within(screen.getByRole('dialog')).getAllByRole('img');
		const transactionTypes = icons.map(icon => icon.getAttribute('alt')).filter(alt => alt !== 'Close');
		expect(transactionTypes).toEqual(expectedTypes);
	});

	it.each(expectedTypes)('requests %s and displays an empty result when there are no matches', async type => {
		// Arrange:
		renderPage();
		await toggleFilterChip('filter_type')();
		const request = TransactionService[requestMethod];
		request.mockClear();

		// Act:
		fireEvent.click(within(screen.getByRole('dialog')).getByAltText(type));

		// Assert:
		await waitFor(() => expect(request.mock.calls).toEqual([
			[{ ...initialFilter, pageNumber: 1, types: type }]
		]));
		expect(await screen.findByText('message_emptyTable')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
	});
});
