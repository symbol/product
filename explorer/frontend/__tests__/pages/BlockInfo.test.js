import '@testing-library/jest-dom';
import { blockWithTransactions, emptyBlock } from '../../__fixtures__/local/block';
import { transactionListConfirmed } from '../../__fixtures__/local/transaction-list-confirmed';
import { runGetServerSidePropsTests, runRenderScenarioTests, runTableErrorTest, runTestCases } from '../test-utils/page';
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
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(blockTransactionPage);
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
const totalFeeTitle = `${blockWithTransactions.totalFee} XEM`;
const createdChainStatus = { height: blockWithTransactions.height };
const blockTransactionPage = {
	data: transactionListConfirmed.filter(transaction => transaction.height === blockWithTransactions.height),
	pageNumber: 1
};
const transactionSearchCriteria = {
	pageNumber: 1,
	height: blockWithTransactions.height,
	pageSize: 50
};
const transactionSquaresSearchCriteria = {
	pageSize: MAX_TRANSACTION_SQUARES,
	height: blockWithTransactions.height
};
const emptyPage = {
	data: [],
	pageNumber: 1
};

// NEM specific constants

const nemSafeChainStatus = { height: blockWithTransactions.height + config.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT + 1 };

// Tests

describe('BlockInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { blockInfo: [BlockService, 'fetchBlockInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the block info props',
				config: {
					responses: { blockInfo: blockWithTransactions }
				},
				expected: {
					requestArguments: { blockInfo: [blockWithTransactions.height] },
					result: {
						props: { blockInfo: blockWithTransactions }
					}
				}
			},
			{
				description: 'returns not found when the block does not exist',
				config: {
					responses: { blockInfo: null }
				},
				expected: {
					requestArguments: { blockInfo: [blockWithTransactions.height] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { height: blockWithTransactions.height },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainStatus.mockResolvedValue(config.chainStatus ?? createdChainStatus);
			if (config.transactionPage)
				TransactionService.fetchTransactionPage.mockResolvedValue(config.transactionPage);
			render(<BlockInfo blockInfo={config.blockInfo} />);
		};

		describe('section: block', () => {
			const blockCases = [
				{
					description: 'renders the height, timestamp and total fee',
					config: { blockInfo: blockWithTransactions },
					expected: {
						texts: [
							SCREEN_TEXT.sectionBlock,
							SCREEN_TEXT.fieldHeight,
							blockWithTransactions.height,
							SCREEN_TEXT.fieldStatus,
							timestampTitleText,
							SCREEN_TEXT.fieldTotalFee
						],
						// The block's only transaction pays the whole total fee, so its table row repeats the amount.
						titleOccurrences: { [totalFeeTitle]: 2 }
					}
				},
				{
					description: 'renders the created status when the block is recent',
					config: { blockInfo: blockWithTransactions },
					expected: {
						texts: [SCREEN_TEXT.labelCreated],
						hiddenTexts: [SCREEN_TEXT.labelSafe, SCREEN_TEXT.labelFinalized]
					}
				},
				{
					description: 'renders the safe status when the block is buried deeper than the unwind limit',
					variants: ['nem'],
					config: {
						blockInfo: blockWithTransactions,
						chainStatus: nemSafeChainStatus
					},
					expected: {
						texts: [SCREEN_TEXT.labelSafe],
						hiddenTexts: [SCREEN_TEXT.labelCreated]
					}
				},
				{
					description: 'renders the finalized status when the block is finalized',
					variants: ['symbol'],
					config: {
						blockInfo: {
							...blockWithTransactions,
							isFinalized: true
						}
					},
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
					description: 'renders the chart when the transaction count is not exceeding the limit',
					config: { blockInfo: blockWithTransactions },
					expected: {
						texts: [SCREEN_TEXT.fieldTransactionFees],
						asyncTexts: [mockedChartText],
						hiddenTexts: [SCREEN_TEXT.messageTooManyTransactions]
					}
				},
				{
					description: 'renders the empty message when the block has no transactions',
					config: {
						blockInfo: emptyBlock,
						transactionPage: emptyPage
					},
					expected: {
						// The empty message appears twice: the treemap and the empty transactions table.
						asyncTextOccurrences: { [SCREEN_TEXT.messageEmptyTable]: 2 },
						hiddenTexts: [mockedChartText]
					}
				},
				{
					description: 'renders the too many transactions message when the transaction count is exceeding the limit',
					config: {
						blockInfo: {
							...blockWithTransactions,
							transactionCount: MAX_TRANSACTION_SQUARES + 1
						}
					},
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
					renderPage({
						blockInfo: {
							...blockWithTransactions,
							transactionCount: config.transactionCount
						}
					});
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
					description: 'requests the treemap transactions when the block is at the cap',
					config: { transactionCount: MAX_TRANSACTION_SQUARES },
					expected: { isTreemapRequested: true }
				},
				{
					description: 'does not request the treemap transactions when the block is above the cap',
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
					config: { blockInfo: blockWithTransactions },
					expected: {
						texts: [
							SCREEN_TEXT.fieldHarvester,
							blockWithTransactions.harvester,
							SCREEN_TEXT.fieldTransactions,
							SCREEN_TEXT.fieldSize,
							`${blockWithTransactions.size} B`,
							SCREEN_TEXT.fieldDifficulty,
							`${blockWithTransactions.difficulty} %`,
							SCREEN_TEXT.fieldSignature,
							blockWithTransactions.signature,
							SCREEN_TEXT.fieldHash,
							blockWithTransactions.hash
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: detailsCases });
		});

		describe('section: transactions', () => {
			const renderBlockInfo = () => render(<BlockInfo blockInfo={blockWithTransactions} />);

			const transactionsCases = [
				{
					description: 'renders the table headers and transaction rows',
					config: { blockInfo: blockWithTransactions },
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
						asyncTexts: blockTransactionPage.data.map(transaction => truncateString(transaction.hash, 'hash'))
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionsCases });

			runTableErrorTest('renders the try-again action when the transaction request fails', {
				renderPage: renderBlockInfo,
				request: [TransactionService, 'fetchTransactionPage']
			});
		});
	});
});
