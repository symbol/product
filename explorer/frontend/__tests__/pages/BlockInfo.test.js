import '@testing-library/jest-dom';
import { blockInfoResult } from '../test-utils/blocks';
import { transactionPageResult } from '../test-utils/transactions';
import * as BlockService from '@/app/api/blocks';
import * as TransactionService from '@/app/api/transactions';
import { MAX_TRANSACTION_SQUARES } from '@/app/components/ValueTransactionSquares';
import BlockInfo, { getServerSideProps } from '@/app/pages/blocks/[height]';
import * as utils from '@/app/utils';
import { act, render, screen } from '@testing-library/react';
/* eslint-disable import/no-unresolved */
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

jest.mock('@/app/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils')
	};
});

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

describe('BlockInfo', () => {
	const renderPage = async (blockInfo, nextPageResult = { data: [], pageNumber: 2 }) => {
		mockAllIsIntersecting(false);
		const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
		fetchTransactionPage.mockImplementation(async ({ pageNumber }) => {
			if (undefined === pageNumber)
				return transactionPageResult;

			return 1 === pageNumber ? { ...transactionPageResult, pageNumber: 1 } : nextPageResult;
		});
		jest.spyOn(BlockService, 'fetchChainStatus').mockResolvedValue({ height: blockInfo.height, finalizedHeight: null });

		await act(async () => {
			render(<BlockInfo blockInfo={blockInfo} />);
		});

		return fetchTransactionPage;
	};

	describe('getServerSideProps', () => {
		const runTest = async (blockInfoResult, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { height: '1111111' };

			const fetchBlockInfo = jest.spyOn(BlockService, 'fetchBlockInfo');
			fetchBlockInfo.mockResolvedValue(blockInfoResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchBlockInfo).toHaveBeenCalledWith(params.height);
			expect(result).toEqual(expectedResult);
		};

		it('returns block info', async () => {
			// Arrange:
			const blockInfo = blockInfoResult;
			const expectedResult = {
				props: {
					blockInfo
				}
			};

			// Act + Assert:
			await runTest(blockInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const blockInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(blockInfo, expectedResult);
		});
	});

	describe('page', () => {
		it('renders page with the information about the block', async () => {
			// Arrange:
			const pageSectionText = 'section_block';
			const heightText = blockInfoResult.height;
			const difficultyText = `${blockInfoResult.difficulty} %`;
			const sizeText = `${blockInfoResult.size} B`;
			const harvesterText = blockInfoResult.harvester;

			// Act:
			await renderPage(blockInfoResult);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(heightText)).toBeInTheDocument();
			expect(screen.getByText(difficultyText)).toBeInTheDocument();
			expect(screen.getByText(sizeText)).toBeInTheDocument();
			expect(screen.getByText(harvesterText)).toBeInTheDocument();
		});

		const runStatusLabelTest = async (chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText) => {
			// Arrange:
			const spy = jest.spyOn(utils, 'useAsyncCall');
			spy.mockImplementation(() => ({ height: blockInfoResult.height + chainHeightOffset, finalizedHeight: null }));

			// Act:
			await renderPage(blockInfoResult);

			// Assert:
			expect(screen.getByText(expectedShownLabelText)).toBeInTheDocument();
			expect(screen.queryByText(expectedHiddenLabelText)).not.toBeInTheDocument();
		};

		it('renders safe label', async () => {
			// Arrange:
			const chainHeightOffset = 361;
			const expectedShownLabelText = 'label_safe';
			const expectedHiddenLabelText = 'label_unsafe';

			// Act + Assert:
			await runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});

		it('renders created label', async () => {
			// Arrange:
			const chainHeightOffset = 100;
			const expectedShownLabelText = 'label_created';
			const expectedHiddenLabelText = 'label_safe';

			// Act + Assert:
			await runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});
	});

	describe('transactions', () => {
		const TRANSACTION_PAGE_SIZE = 50;

		it('requests the first transaction page and the fee visualisation data', async () => {
			// Arrange:
			const transactionHashes = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act:
			const fetchTransactionPage = await renderPage(blockInfoResult);

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledTimes(2);
			expect(fetchTransactionPage).toHaveBeenCalledWith({
				pageNumber: 1,
				height: blockInfoResult.height,
				pageSize: TRANSACTION_PAGE_SIZE
			});
			expect(fetchTransactionPage).toHaveBeenCalledWith({
				height: blockInfoResult.height,
				pageSize: MAX_TRANSACTION_SQUARES
			});
			transactionHashes.forEach(hash => expect(screen.getByText(hash)).toBeInTheDocument());
			expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
			expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
		});

		it('requests the next transaction page from the server', async () => {
			// Arrange:
			const fetchTransactionPage = await renderPage(blockInfoResult);

			// Act:
			await act(async () => {
				mockAllIsIntersecting(true);
			});

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledWith({
				pageNumber: 2,
				height: blockInfoResult.height,
				pageSize: TRANSACTION_PAGE_SIZE
			});
		});

		it('keeps the fee visualisation when the block sits exactly on the cap', async () => {
			// Arrange:
			const blockInfo = { ...blockInfoResult, transactionCount: MAX_TRANSACTION_SQUARES };

			// Act:
			const fetchTransactionPage = await renderPage(blockInfo);

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledTimes(2);
			expect(fetchTransactionPage).toHaveBeenCalledWith({
				height: blockInfo.height,
				pageSize: MAX_TRANSACTION_SQUARES
			});
			expect(screen.queryByText('message_tooManyTransactionsToVisualize')).not.toBeInTheDocument();
		});

		it('skips the fee visualisation when the block is too large for the chart', async () => {
			// Arrange:
			const blockInfo = { ...blockInfoResult, transactionCount: MAX_TRANSACTION_SQUARES + 1 };

			// Act:
			const fetchTransactionPage = await renderPage(blockInfo);

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledTimes(1);
			expect(fetchTransactionPage).toHaveBeenCalledWith({
				pageNumber: 1,
				height: blockInfo.height,
				pageSize: TRANSACTION_PAGE_SIZE
			});
			expect(screen.getByText('message_tooManyTransactionsToVisualize')).toBeInTheDocument();
		});
	});
});
