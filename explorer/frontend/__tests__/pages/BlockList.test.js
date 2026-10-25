import '@testing-library/jest-dom';
import { blockWithTransactions } from '../../__fixtures__/local/block';
import { blockList } from '../../__fixtures__/local/block-list';
import { blockStats } from '../../__fixtures__/local/block-stats';
import { blockWithTransactions as symbolBlockWithTransactions } from '../../__fixtures__/local/symbol/block-list';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import config from '@/app/config';
import BlockList, { getServerSideProps } from '@/app/pages/blocks';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

beforeEach(() => {
	jest.spyOn(BlockService, 'fetchChainStatus').mockResolvedValue(nemCreatedChainStatus);
});

// Constants

const SCREEN_TEXT = {
	sectionBlocks: 'section_blocks',
	fieldBlockGenerationTime: 'field_blockGenerationTime',
	valueBlockGenerationTime: 'value_blockGenerationTime',
	fieldAverageFee: 'field_averageFee',
	valueAverageFee: 'value_averageFee',
	fieldDifficulty: 'field_difficulty',
	tableFieldHeight: 'table_field_height',
	tableFieldHarvester: 'table_field_harvester',
	tableFieldTransactionCount: 'table_field_transactionCount',
	tableFieldStatementCount: 'table_field_statementCount',
	tableFieldTotalFee: 'table_field_totalFee',
	tableFieldBlockReward: 'table_field_blockReward',
	fieldTimestamp: 'field_timestamp',
	fieldTimestampUTC: 'field_timestampUTC',
	labelCreated: 'label_created',
	labelSafe: 'label_safe'
};

const mockedChartText = 'Mocked React ApexCharts';
const blockGenerationTimeText = `${SCREEN_TEXT.valueBlockGenerationTime}::value:${blockStats.blockTime}`;
const averageFeeText = `${SCREEN_TEXT.valueAverageFee}::value:${blockStats.blockFee}`;
const timestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldTimestamp}`;
const nemUnwindLimit = config.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT;
const nemCreatedChainStatus = {
	height: blockWithTransactions.height + nemUnwindLimit - 1,
	finalizedHeight: null
};
const nemSafeChainStatus = {
	height: blockWithTransactions.height + nemUnwindLimit + 1,
	finalizedHeight: null
};
const blockPage = {
	data: blockList,
	pageNumber: 1
};

// Tests

describe('BlockList', () => {
	describe('getServerSideProps', () => {
		const requests = {
			blockPage: [BlockService, 'fetchBlockPage'],
			blockStats: [StatsService, 'fetchBlockStats']
		};

		const getServerSidePropsCases = [
			{
				description: 'returns the blocks and the block stats props',
				config: {
					responses: {
						blockPage,
						blockStats
					}
				},
				expected: {
					requestArguments: {
						blockPage: [],
						blockStats: []
					},
					result: {
						props: {
							blocks: blockList,
							nextPageParams: null,
							stats: blockStats
						}
					}
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainStatus.mockResolvedValue(config.chainStatus ?? nemCreatedChainStatus);
			render(<BlockList blocks={config.blocks} stats={blockStats} />);
		};

		describe('section: blocks', () => {
			const blocksCases = [
				{
					description: 'renders the block stats',
					config: { blocks: blockList },
					expected: {
						texts: [
							SCREEN_TEXT.sectionBlocks,
							SCREEN_TEXT.fieldBlockGenerationTime,
							blockGenerationTimeText,
							SCREEN_TEXT.fieldAverageFee,
							averageFeeText,
							SCREEN_TEXT.fieldDifficulty,
							`${blockStats.blockDifficulty}%`
						],
						asyncTextOccurrences: { [mockedChartText]: 3 }
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: blocksCases });
		});

		describe('block table', () => {
			const blockTableCases = [
				{
					description: 'renders the table headers and the block rows',
					config: { blocks: blockList },
					expected: {
						texts: [
							SCREEN_TEXT.tableFieldHeight,
							SCREEN_TEXT.tableFieldHarvester,
							SCREEN_TEXT.tableFieldTransactionCount,
							SCREEN_TEXT.tableFieldTotalFee,
							timestampText,
							...blockList.map(block => block.height),
							...blockList.map(block => block.harvester)
						],
						titles: [`${blockWithTransactions.totalFee} XEM`]
					}
				},
				{
					description: 'renders the statement count and the block reward columns',
					variants: ['symbol'],
					config: { blocks: [symbolBlockWithTransactions] },
					expected: {
						texts: [
							SCREEN_TEXT.tableFieldStatementCount,
							SCREEN_TEXT.tableFieldBlockReward,
							symbolBlockWithTransactions.statementCount
						],
						titles: [`${symbolBlockWithTransactions.blockReward} XEM`]
					}
				},
				{
					description: 'does not render the statement count and the block reward columns',
					variants: ['nem'],
					config: { blocks: blockList },
					expected: {
						texts: [SCREEN_TEXT.tableFieldTransactionCount, SCREEN_TEXT.tableFieldTotalFee],
						hiddenTexts: [SCREEN_TEXT.tableFieldStatementCount, SCREEN_TEXT.tableFieldBlockReward]
					}
				},
				{
					description: 'renders the created status when the block depth is below the unwind limit',
					variants: ['nem'],
					config: {
						blocks: [blockWithTransactions],
						chainStatus: nemCreatedChainStatus
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelCreated]: 1,
							[SCREEN_TEXT.labelSafe]: 0
						}
					}
				},
				{
					description: 'renders the safe status when the block depth is above the unwind limit',
					variants: ['nem'],
					config: {
						blocks: [blockWithTransactions],
						chainStatus: nemSafeChainStatus
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelCreated]: 0,
							[SCREEN_TEXT.labelSafe]: 1
						}
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: blockTableCases });
		});
	});
});
