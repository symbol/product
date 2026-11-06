import { accountInfoResponse, remoteAccountInfoResponse } from '../../../../__fixtures__/api/symbol/account-info';
import { harvestBlockResponses, harvestReceiptsResponse } from '../../../../__fixtures__/api/symbol/harvest-receipts';
import { accountInfo, remoteAccountInfo } from '../../../../__fixtures__/local/symbol/account';
import { setDevice } from '../../../test-utils/device';
import { runGetServerSidePropsTests } from '../../../test-utils/page';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo, { getServerSideProps } from '@/app/pages/accounts/[address]';
import * as serverUtils from '@/app/utils/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

jest.mock('@/app/utils/server', () => ({ __esModule: true, ...jest.requireActual('@/app/utils/server') }));
jest.mock('@/app/api/transactions', () => ({ __esModule: true, ...jest.requireActual('@/app/api/transactions') }));
jest.mock('@/app/api/stats', () => ({ __esModule: true, ...jest.requireActual('@/app/api/stats') }));
// Inspect the final CSV payload at the download-library boundary, keeping ButtonCSV and its formatter real.
jest.mock('react-csv', () => ({
	CSVLink: ({ data, filename, children }) => <a download={filename} data-csv={JSON.stringify(data)}>{children}</a>
}));

const address = 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY';
const otherAddress = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI';
const baseURL = 'https://explorer.backend';
const receiptURL = `${baseURL}/receipts?limit=10&offset=0&targetAddress=${address}&receiptType=8515&group=balanceChange`;
const otherReceiptURL = `${baseURL}/receipts?limit=10&offset=0&targetAddress=${otherAddress}&receiptType=8515&group=balanceChange`;
const fullHarvestReceiptPageResponse = Array.from({ length: 10 }, (_, index) => ({
	...harvestReceiptsResponse[0],
	mosaics: [{ ...harvestReceiptsResponse[0].mosaics[0], amount: index + 1 }]
}));
const page = account => <AccountInfo accountInfo={account} preloadedTransactions={[]} />;
const csvLink = () => screen.getAllByText('button_csv').find(link => link.getAttribute('download').startsWith('harvested-blocks-'));
const csvData = () => JSON.parse(csvLink().getAttribute('data-csv'));
const openHarvests = () => fireEvent.click(screen.getByText('section_harvested'));

beforeEach(() => {
	jest.spyOn(StatsService, 'fetchPriceByDate').mockResolvedValue(0);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue({ data: [], pageNumber: 1 });
});

describe('Symbol account harvested history', () => {
	describe.each([
		['A', accountInfoResponse, accountInfo],
		['B', remoteAccountInfoResponse, remoteAccountInfo]
	])('SSR account %s', (_name, response, expectedAccount) => {
		runGetServerSidePropsTests({
			getServerSideProps,
			params: { address: expectedAccount.address },
			requests: {
				account: [serverUtils, 'makeRequest'],
				transactions: [TransactionService, 'fetchTransactionPage']
			},
			cases: [{
				description: 'passes the REST account model and transactions for the same address',
				config: { responses: { account: response, transactions: { data: [], pageNumber: 1 } } },
				expected: {
					requestArguments: {
						account: [`${baseURL}/account?address=${expectedAccount.address}`],
						transactions: [{ address: expectedAccount.address }]
					},
					result: { props: { accountInfo: expectedAccount, preloadedTransactions: [] } }
				}
			}]
		});
	});

	it.each(['desktop', 'mobile'])('renders REST receipt rows and exports the same loaded rows on %s', async device => {
		// Arrange:
		setDevice(device);
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce(accountInfoResponse)
			.mockResolvedValueOnce(harvestReceiptsResponse)
			.mockResolvedValueOnce(harvestBlockResponses[0])
			.mockResolvedValueOnce(harvestBlockResponses[1]);

		// Act:
		const { props } = await getServerSideProps({ locale: 'en', params: { address } });
		render(<AccountInfo {...props} />);
		openHarvests();

		// Assert:
		await waitFor(() => expect(screen.getAllByText('1234')).toHaveLength(2));
		expect(screen.getByText('field_address').parentElement).toHaveTextContent(address);
		expect(screen.getByText('field_publicKey').parentElement).toHaveTextContent('01'.repeat(32));
		expect(screen.getByText('1200')).toBeInTheDocument();
		expect(screen.getByTitle('1.234567 XEM')).toBeInTheDocument();
		expect(screen.getByTitle('0.000001 XEM')).toBeInTheDocument();
		expect(screen.getAllByText('month_oct 20, 2026 • 01:02')).toHaveLength(2);
		expect(screen.getByText('month_oct 19, 2026 • 04:05')).toBeInTheDocument();
		expect(screen.queryByText('filter_hideEmptyBlocks')).not.toBeInTheDocument();
		expect(csvLink()).toHaveAttribute('download', `harvested-blocks-${address}.csv`);
		expect(csvData()).toEqual([
			{
				table_field_height: 1234, table_field_type: 'rewardType_harvesting',
				table_field_amount: 1.234567, table_field_timestamp: '2026-10-20 01:02:03'
			},
			{
				table_field_height: 1234, table_field_type: 'rewardType_harvesting',
				table_field_amount: 0.000001, table_field_timestamp: '2026-10-20 01:02:03'
			},
			{
				table_field_height: 1200, table_field_type: 'rewardType_harvesting',
				table_field_amount: 0, table_field_timestamp: '2026-10-19 04:05:06'
			}
		]);
		expect(request.mock.calls).toEqual([
			[`${baseURL}/account?address=${address}`], [receiptURL], [`${baseURL}/block/1234`], [`${baseURL}/block/1200`]
		]);
	});

	it('aligns displayed account details, history and CSV when SSR switches from account A to account B', async () => {
		// Arrange:
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce(accountInfoResponse)
			.mockResolvedValueOnce([harvestReceiptsResponse[0]])
			.mockResolvedValueOnce(harvestBlockResponses[0])
			.mockResolvedValueOnce(remoteAccountInfoResponse)
			.mockResolvedValueOnce([]);
		const first = await getServerSideProps({ locale: 'en', params: { address } });
		const view = render(<AccountInfo {...first.props} />);
		openHarvests();
		await screen.findByText('1234');

		// Act:
		const second = await getServerSideProps({ locale: 'en', params: { address: otherAddress } });
		view.rerender(<AccountInfo {...second.props} />);

		// Assert:
		await screen.findByText('message_emptyTable');
		expect(screen.queryByText('1234')).not.toBeInTheDocument();
		expect(csvData()).toEqual([]);
		expect(csvLink()).toHaveAttribute('download', `harvested-blocks-${otherAddress}.csv`);
		expect(screen.getByText('field_address').parentElement).toHaveTextContent(otherAddress);
		expect(screen.getByText('field_publicKey').parentElement).toHaveTextContent('02'.repeat(32));
		expect(within(screen.getByText('field_balance').parentElement).getByText('0')).toBeInTheDocument();
		expect(request.mock.calls).toEqual([
			[`${baseURL}/account?address=${address}`], [receiptURL], [`${baseURL}/block/1234`],
			[`${baseURL}/account?address=${otherAddress}`], [otherReceiptURL]
		]);
	});

	it.each(['resolve', 'reject'])('ignores a late %s from the previous account', async outcome => {
		// Arrange: the old account is still waiting for its block timestamp.
		let resolveBlock;
		let rejectBlock;
		const pendingBlock = new Promise((resolve, reject) => {
			resolveBlock = resolve;
			rejectBlock = reject;
		});
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce([harvestReceiptsResponse[0]])
			.mockReturnValueOnce(pendingBlock)
			.mockResolvedValueOnce([{ ...harvestReceiptsResponse[2], targetAddress: otherAddress }])
			.mockResolvedValueOnce(harvestBlockResponses[1]);
		const view = render(page(accountInfo));
		openHarvests();
		await waitFor(() => expect(request).toHaveBeenCalledWith(`${baseURL}/block/1234`));

		// Act:
		view.rerender(page(remoteAccountInfo));
		await screen.findByText('1200');
		await act(async () => {
			if (outcome === 'resolve')
				resolveBlock(harvestBlockResponses[0]);
			else
				rejectBlock(new Error('old request failed'));
		});

		// Assert:
		expect(screen.queryByText('1234')).not.toBeInTheDocument();
		expect(screen.getByText('1200')).toBeInTheDocument();
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		expect(screen.getByText('field_address').parentElement).toHaveTextContent(otherAddress);
		expect(screen.getByText('field_publicKey').parentElement).toHaveTextContent('02'.repeat(32));
		expect(csvLink()).toHaveAttribute('download', `harvested-blocks-${otherAddress}.csv`);
		expect(request).toHaveBeenCalledWith(otherReceiptURL);
		expect(csvData()).toEqual([{
			table_field_height: 1200, table_field_type: 'rewardType_harvesting',
			table_field_amount: 0, table_field_timestamp: '2026-10-19 04:05:06'
		}]);
	});

	it('shows a retry action when timestamp retrieval fails and recovers the whole page', async () => {
		// Arrange:
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce([harvestReceiptsResponse[0]])
			.mockRejectedValueOnce(new Error('block unavailable'))
			.mockResolvedValueOnce([harvestReceiptsResponse[0]])
			.mockResolvedValueOnce(harvestBlockResponses[0]);
		render(page(accountInfo));
		openHarvests();
		const retryButton = await screen.findByText('button_tryAgain');

		// Act:
		fireEvent.click(retryButton);

		// Assert:
		await screen.findByText('1234');
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		expect(csvData()).toHaveLength(1);
		expect(request.mock.calls).toEqual([
			[receiptURL], [`${baseURL}/block/1234`], [receiptURL], [`${baseURL}/block/1234`]
		]);
	});

	it('shows request failures as errors instead of empty history', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(new Error('receipts unavailable'));

		// Act:
		render(page(accountInfo));
		openHarvests();

		// Assert:
		await screen.findByText('button_tryAgain');
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
		expect(screen.queryByText('1234')).not.toBeInTheDocument();
		expect(csvData()).toEqual([]);
	});

	it('retries a failed Receipt request for the displayed account', async () => {
		// Arrange:
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockRejectedValueOnce(new Error('receipts unavailable'))
			.mockResolvedValueOnce([harvestReceiptsResponse[0]])
			.mockResolvedValueOnce(harvestBlockResponses[0]);
		render(page(accountInfo));
		openHarvests();
		const retryButton = await screen.findByText('button_tryAgain');

		// Act:
		fireEvent.click(retryButton);

		// Assert:
		await screen.findByText('1234');
		expect(screen.getByText('field_address').parentElement).toHaveTextContent(address);
		expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		expect(csvData()).toEqual([{
			table_field_height: 1234, table_field_type: 'rewardType_harvesting',
			table_field_amount: 1.234567, table_field_timestamp: '2026-10-20 01:02:03'
		}]);
		expect(request.mock.calls).toEqual([[receiptURL], [receiptURL], [`${baseURL}/block/1234`]]);
	});

	it('prepares CSV data from only the loaded first page while another page is available', async () => {
		// Arrange: a full first page permits continuation; the second page has not been requested.
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce(fullHarvestReceiptPageResponse)
			.mockResolvedValueOnce(harvestBlockResponses[0])
			.mockResolvedValueOnce([harvestReceiptsResponse[2]])
			.mockResolvedValueOnce(harvestBlockResponses[1]);

		// Act: render the CSV link's payload without simulating a download click.
		render(page(accountInfo));
		openHarvests();

		// Assert:
		await waitFor(() => expect(screen.getAllByText('1234')).toHaveLength(10));
		expect(csvData()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(amount => ({
			table_field_height: 1234,
			table_field_type: 'rewardType_harvesting',
			table_field_amount: amount,
			table_field_timestamp: '2026-10-20 01:02:03'
		})));
		expect(request.mock.calls).toEqual([[receiptURL], [`${baseURL}/block/1234`]]);
	});

	it('appends the next page, stops at a short page and exports only loaded receipts', async () => {
		// Arrange: ten distinct receipts at one height; none may be deduplicated.
		const request = jest.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce(fullHarvestReceiptPageResponse)
			.mockResolvedValueOnce(harvestBlockResponses[0])
			.mockResolvedValueOnce([harvestReceiptsResponse[2]])
			.mockResolvedValueOnce(harvestBlockResponses[1]);
		render(page(accountInfo));
		openHarvests();
		await waitFor(() => expect(screen.getAllByText('1234')).toHaveLength(10));

		// Act:
		act(() => mockAllIsIntersecting(true));

		// Assert:
		await screen.findByText('1200');
		expect(csvData().map(row => row.table_field_amount)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0]);
		expect(request.mock.calls).toEqual([
			[receiptURL], [`${baseURL}/block/1234`],
			[`${baseURL}/receipts?limit=10&offset=10&targetAddress=${address}&receiptType=8515&group=balanceChange`],
			[`${baseURL}/block/1200`]
		]);
	});
});
