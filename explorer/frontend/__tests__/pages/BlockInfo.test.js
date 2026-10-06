import '@testing-library/jest-dom';
import { blockInfoResult } from '../test-utils/blocks';
import { runGetServerSidePropsTests, runRenderScenarioTests, runTableErrorTest, runTestCases } from '../test-utils/page';
import { transactionPageResult } from '../test-utils/transactions';
import * as BlockService from '@/app/api/blocks';
import * as TransactionService from '@/app/api/transactions';
import { MAX_TRANSACTION_SQUARES } from '@/app/components/ValueTransactionSquares';
import config from '@/app/config';
import BlockInfo, { getServerSideProps } from '@/app/pages/blocks/[height]';
import { truncateString } from '@/app/utils';
import { render, waitFor } from '@testing-library/react';

// Mocks

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

beforeEach(() => {
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(transactionPageResult);
	jest.spyOn(BlockService, 'fetchChainStatus').mockResolvedValue(createdChainStatus);
});

// Constants

const SCREEN_TEXT = {
	sectionBlock: 'section_block',
	sectionTransactions: 'section_transactions',
	fieldHeight: 'field_height',
	fieldStatus: 'field_status',
	fieldTimestamp: 'field_timestamp',
	fieldTimestampUTC: 'field_timestampUTC',
	fieldTotalFee: 'field_totalFee',
	fieldTransactionFees: 'field_transactionFees',
	fieldHarvester: 'field_harvester',
	fieldTransactions: 'field_transactions',
	fieldSize: 'field_size',
	fieldDifficulty: 'field_difficulty',
	fieldSignature: 'field_signature',
	fieldHash: 'field_hash',
	labelCreated: 'label_created',
	labelSafe: 'label_safe',
	labelFinalized: 'label_finalized',
	messageEmptyTable: 'message_emptyTable',
	messageTooManyTransactions: 'message_tooManyTransactionsToVisualize',
	tableFieldHash: 'table_field_hash',
	tableFieldType: 'table_field_type',
	tableFieldSender: 'table_field_sender',
	tableFieldRecipient: 'table_field_recipient',
	tableFieldValue: 'table_field_value',
	tableFieldFee: 'table_field_fee'
};

const mockedChartText = 'Mocked React ApexCharts';
const timestampTitleText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldTimestamp}`;
const createdChainStatus = { height: blockInfoResult.height };
const transactionSearchCriteria = {
	pageNumber: 1,
	height: blockInfoResult.height,
	pageSize: 50
};
const transactionSquaresSearchCriteria = {
	pageSize: MAX_TRANSACTION_SQUARES,
	height: blockInfoResult.height
};
const emptyPage = {
	data: [],
	pageNumber: 1
};

// NEM specific constants

const nemSafeChainStatus = { height: blockInfoResult.height + config.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT + 1 };

// Tests

describe('BlockInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { blockInfo: [BlockService, 'fetchBlockInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the block info',
				config: {
					responses: { blockInfo: blockInfoResult }
				},
				expected: {
					requestArguments: { blockInfo: [blockInfoResult.height] },
					result: {
						props: { blockInfo: blockInfoResult }
					}
				}
			},
			{
				description: 'returns not found when the block does not exist',
				config: {
					responses: { blockInfo: null }
				},
				expected: {
					requestArguments: { blockInfo: [blockInfoResult.height] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { height: blockInfoResult.height },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainStatus.mockResolvedValue(config.chainStatus ?? createdChainStatus);
			if (config.transactionPage)
				TransactionService.fetchTransactionPage.mockResolvedValue(config.transactionPage);
			render(<BlockInfo blockInfo={{ ...blockInfoResult, ...config.blockInfo }} />);
		};

		describe('section: block', () => {
			const blockCases = [
				{
					description: 'renders the height, timestamp and total fee',
					config: {},
					expected: {
						texts: [
							SCREEN_TEXT.sectionBlock,
							SCREEN_TEXT.fieldHeight,
							blockInfoResult.height,
							SCREEN_TEXT.fieldStatus,
							timestampTitleText,
							SCREEN_TEXT.fieldTotalFee,
							blockInfoResult.totalFee
						]
					}
				},
				{
					description: 'renders the created status for a recent block',
					config: {},
					expected: {
						texts: [SCREEN_TEXT.labelCreated],
						hiddenTexts: [SCREEN_TEXT.labelSafe, SCREEN_TEXT.labelFinalized]
					}
				},
				{
					description: 'renders the safe status for a block buried deeper than the unwind limit',
					variants: ['nem'],
					config: { chainStatus: nemSafeChainStatus },
					expected: {
						texts: [SCREEN_TEXT.labelSafe],
						hiddenTexts: [SCREEN_TEXT.labelCreated]
					}
				},
				{
					description: 'renders the finalized status for a finalized block',
					variants: ['symbol'],
					config: { blockInfo: { isFinalized: true } },
					expected: {
						texts: [SCREEN_TEXT.labelFinalized],
						hiddenTexts: [SCREEN_TEXT.labelCreated]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: blockCases });
		});

		describe('fee treemap', () => {
			const treemapCases = [
				{
					description: 'renders the chart when the block transactions fit the cap',
					config: {},
					expected: {
						texts: [SCREEN_TEXT.fieldTransactionFees],
						asyncTexts: [mockedChartText],
						hiddenTexts: [SCREEN_TEXT.messageTooManyTransactions]
					}
				},
				{
					description: 'renders the empty message when the block has no transactions',
					config: {
						blockInfo: { transactionCount: 0 },
						transactionPage: emptyPage
					},
					expected: {
						// The empty message appears twice: the treemap and the empty transactions table.
						asyncTextOccurrences: { [SCREEN_TEXT.messageEmptyTable]: 2 },
						hiddenTexts: [mockedChartText]
					}
				},
				{
					description: 'renders the too many transactions message for a block above the cap',
					config: { blockInfo: { transactionCount: MAX_TRANSACTION_SQUARES + 1 } },
					expected: {
						texts: [SCREEN_TEXT.messageTooManyTransactions],
						hiddenTexts: [mockedChartText]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: treemapCases });

			const runTreemapRequestTest = (description, config, expected) => {
				it(description, async () => {
					// Act:
					renderPage({ blockInfo: { transactionCount: config.transactionCount } });
					// the transaction table request is made for any block, so it settles the mount requests first.
					await waitFor(() => expect(TransactionService.fetchTransactionPage).toHaveBeenCalledWith(transactionSearchCriteria));

					// Assert: 
					if (expected.isTreemapRequested) {
						await waitFor(() =>
							expect(TransactionService.fetchTransactionPage).toHaveBeenCalledWith(transactionSquaresSearchCriteria));
					} else {
						// Give a scheduled treemap request a timer tick to fire before asserting its absence.
						await new Promise(resolve => setTimeout(resolve));
						expect(TransactionService.fetchTransactionPage).not.toHaveBeenCalledWith(transactionSquaresSearchCriteria);
					}
				});
			};

			const treemapRequestCases = [
				{
					description: 'requests the treemap transactions for a block at the cap',
					config: { transactionCount: MAX_TRANSACTION_SQUARES },
					expected: { isTreemapRequested: true }
				},
				{
					description: 'does not request the treemap transactions for a block above the cap',
					config: { transactionCount: MAX_TRANSACTION_SQUARES + 1 },
					expected: { isTreemapRequested: false }
				}
			];

			runTestCases(runTreemapRequestTest, treemapRequestCases);
		});

		describe('section: details', () => {
			const detailsCases = [
				{
					description: 'renders the harvester, size, difficulty, signature and hash',
					config: {},
					expected: {
						texts: [
							SCREEN_TEXT.fieldHarvester,
							blockInfoResult.harvester,
							SCREEN_TEXT.fieldTransactions,
							SCREEN_TEXT.fieldSize,
							`${blockInfoResult.size} B`,
							SCREEN_TEXT.fieldDifficulty,
							`${blockInfoResult.difficulty} %`,
							SCREEN_TEXT.fieldSignature,
							blockInfoResult.signature,
							SCREEN_TEXT.fieldHash,
							blockInfoResult.hash
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: detailsCases });
		});

		describe('section: transactions', () => {
			const renderBlockInfo = () => render(<BlockInfo blockInfo={blockInfoResult} />);

			const transactionsCases = [
				{
					description: 'renders the table headers and transaction rows',
					config: {},
					expected: {
						texts: [
							SCREEN_TEXT.sectionTransactions,
							SCREEN_TEXT.tableFieldHash,
							SCREEN_TEXT.tableFieldType,
							SCREEN_TEXT.tableFieldSender,
							SCREEN_TEXT.tableFieldRecipient,
							SCREEN_TEXT.tableFieldValue,
							SCREEN_TEXT.tableFieldFee
						],
						asyncTexts: transactionPageResult.data.map(transaction => truncateString(transaction.hash, 'hash'))
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionsCases });

			runTableErrorTest('shows the try-again action when the transaction request fails', {
				renderPage: renderBlockInfo,
				request: [TransactionService, 'fetchTransactionPage']
			});
		});
	});
});
