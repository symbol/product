import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { setDevice } from '../test-utils/device';
import { blockStatisticsResult } from '../test-utils/stats';
import * as BlockService from '@/api/blocks';
import * as StatsService from '@/api/stats';
import config from '@/config';
import BlockList, { getServerSideProps } from '@/pages/blocks/index';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

const mockT = jest.fn(key => ('date_format' === key ? 'YYYY/MM/DD' : key));

jest.mock('next-i18next', () => ({
	useTranslation: () => ({
		t: mockT
	})
}));

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
	const originalTicker = config.NATIVE_MOSAIC_TICKER;
	const originalShowFinalization = pageConfig.blocks.showFinalization;
	const originalShowStatementCount = pageConfig.blocks.showStatementCount;
	const originalShowBlockReward = pageConfig.blocks.showBlockReward;

	beforeEach(() => {
		setDevice('desktop');
		mockT.mockClear();
		mockT.mockImplementation(key => ('date_format' === key ? 'YYYY/MM/DD' : key));
		config.NATIVE_MOSAIC_TICKER = originalTicker;
		pageConfig.blocks.showFinalization = originalShowFinalization;
		pageConfig.blocks.showStatementCount = originalShowStatementCount;
		pageConfig.blocks.showBlockReward = originalShowBlockReward;
	});

	afterEach(() => {
		config.NATIVE_MOSAIC_TICKER = originalTicker;
		pageConfig.blocks.showFinalization = originalShowFinalization;
		pageConfig.blocks.showStatementCount = originalShowStatementCount;
		pageConfig.blocks.showBlockReward = originalShowBlockReward;
	});

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
			const transactionCount = 99;
			const blocks = [{ ...blockPageResult.data[0], transactionCount }];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getAllByText('table_field_transactionCount')).toHaveLength(2);
			expect(screen.getByText(transactionCount)).toBeInTheDocument();
		});

		it('uses configured native mosaic ticker for average fee display', () => {
			// Arrange:
			config.NATIVE_MOSAIC_TICKER = 'XYM';

			// Act:
			render(<BlockList blocks={blockPageResult.data} stats={blockStatisticsResult} />);

			// Assert:
			expect(mockT).toHaveBeenCalledWith('value_averageFee', {
				value: blockStatisticsResult.blockFee,
				ticker: 'XYM'
			});
			expect(mockT).toHaveBeenCalledWith('chart_series_fee', {
				ticker: 'XYM'
			});
		});

		it('renders timestamp in Japanese date time format', () => {
			// Act:
			render(<BlockList blocks={[blockPageResult.data[0]]} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByText('2024/03/30 01:06')).toBeInTheDocument();
			expect(mockT).toHaveBeenCalledWith('field_timestamp');
		});

		it('renders statement count column for Symbol blocks', () => {
			// Arrange:
			pageConfig.blocks.showFinalization = true;
			pageConfig.blocks.showStatementCount = true;
			pageConfig.blocks.showBlockReward = true;
			const statementCount = 123;
			const blockReward = 999;
			const blocks = [{ ...blockPageResult.data[0], statementCount, blockReward, isFinalized: true }];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByText('table_field_statementCount')).toBeInTheDocument();
			expect(screen.getByText(statementCount)).toBeInTheDocument();
			expect(screen.getByText('table_field_blockReward')).toBeInTheDocument();
			expect(screen.getByText(blockReward)).toBeInTheDocument();
			expect(screen.getByAltText('Finalized block')).toBeInTheDocument();
		});

		it('renders pending finalization icon for unfinalized Symbol blocks', () => {
			// Arrange:
			pageConfig.blocks.showFinalization = true;
			const blocks = [{ ...blockPageResult.data[0], isFinalized: false }];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByAltText('Unfinalized block')).toBeInTheDocument();
		});

		it('renders Symbol block details on mobile', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.blocks.showFinalization = true;
			pageConfig.blocks.showStatementCount = true;
			pageConfig.blocks.showBlockReward = true;
			const statementCount = 321;
			const blockReward = 456;
			const blocks = [{ ...blockPageResult.data[0], statementCount, blockReward, isFinalized: true }];

			// Act:
			render(<BlockList blocks={blocks} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.getByAltText('Finalized block')).toBeInTheDocument();
			expect(screen.getAllByText('table_field_statementCount')).toHaveLength(2);
			expect(screen.getByText(statementCount)).toBeInTheDocument();
			expect(screen.getAllByText('table_field_blockReward')).toHaveLength(2);
			expect(screen.getByText(blockReward)).toBeInTheDocument();
		});

		it('does not render block reward column for NEM blocks', () => {
			// Arrange:
			pageConfig.blocks.showFinalization = false;
			pageConfig.blocks.showStatementCount = false;
			pageConfig.blocks.showBlockReward = false;

			// Act:
			render(<BlockList blocks={blockPageResult.data} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.queryByText('table_field_blockReward')).not.toBeInTheDocument();
			expect(screen.queryByAltText('Finalized block')).not.toBeInTheDocument();
			expect(screen.queryByAltText('Unfinalized block')).not.toBeInTheDocument();
		});

		it('does not render Symbol block details on NEM mobile', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.blocks.showFinalization = false;
			pageConfig.blocks.showStatementCount = false;
			pageConfig.blocks.showBlockReward = false;

			// Act:
			render(<BlockList blocks={blockPageResult.data} stats={blockStatisticsResult} />);

			// Assert:
			expect(screen.queryByText('table_field_statementCount')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_blockReward')).not.toBeInTheDocument();
			expect(screen.queryByAltText('Finalized block')).not.toBeInTheDocument();
			expect(screen.queryByAltText('Unfinalized block')).not.toBeInTheDocument();
		});
	});
});
