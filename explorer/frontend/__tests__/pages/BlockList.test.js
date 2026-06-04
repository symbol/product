import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { setDevice } from '../test-utils/device';
import { blockStatisticsResult } from '../test-utils/stats';
import * as BlockService from '@/api/blocks';
import * as StatsService from '@/api/stats';
import BlockList, { getServerSideProps } from '@/pages/blocks/index';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('BlockList', () => {
	describe('getServerSideProps', () => {
		it('fetches block list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage');
			fetchBlockPage.mockResolvedValue(blockPageResult);
			const fetchBlockStats = jest.spyOn(StatsService, 'fetchBlockStats');
			fetchBlockStats.mockResolvedValue(blockStatisticsResult);
			const expectedResult = {
				props: {
					blocks: blockPageResult.data,
					stats: blockStatisticsResult
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchBlockPage).toHaveBeenCalledWith();
			expect(fetchBlockStats).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		afterEach(() => {
			pageConfig.blocks.showFinalization = false;
			pageConfig.blocks.showStatementCount = false;
			pageConfig.blocks.showBlockReward = false;
		});

		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_blocks';
			const blocksHeight = blockPageResult.data.map(block => block.height);

			// Act:
			render(<BlockList blocks={blockPageResult.data} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			blocksHeight.forEach(height => {
				expect(screen.getByText(height)).toBeInTheDocument();
			});
		};

		it('renders page with the list of blocks on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of blocks on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});

		it('renders Symbol block-list columns on desktop when enabled by page config', () => {
			// Arrange:
			pageConfig.blocks.showFinalization = true;
			pageConfig.blocks.showStatementCount = true;
			pageConfig.blocks.showBlockReward = true;
			const blocks = [
				{
					...blockPageResult.data[0],
					blockReward: 1.25,
					isFinalized: true,
					statementCount: 2
				}
			];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByText('table_field_statementCount')).toBeInTheDocument();
			expect(screen.getByText('table_field_blockReward')).toBeInTheDocument();
			expect(screen.getByAltText('Finalized block')).toBeInTheDocument();
		});

		it('renders Symbol block-list fields on mobile when enabled by page config', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.blocks.showFinalization = true;
			pageConfig.blocks.showStatementCount = true;
			pageConfig.blocks.showBlockReward = true;
			const blocks = [
				{
					...blockPageResult.data[0],
					blockReward: 1.25,
					isFinalized: false,
					statementCount: 2
				}
			];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getAllByText('table_field_statementCount')).toHaveLength(2);
			expect(screen.getAllByText('table_field_blockReward')).toHaveLength(2);
			expect(screen.getByAltText('Unfinalized block')).toBeInTheDocument();
		});
	});
});
