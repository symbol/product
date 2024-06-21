import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { blockPageResult } from '../test-utils/blocks';
import { setDevice } from '../test-utils/device';
import { blockStatsResult } from '../test-utils/stats';
import * as BlockService from '@/api/blocks';
import * as StatsService from '@/api/stats';
import BlockList, { getServerSideProps } from '@/pages/blocks/index';
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
			fetchBlockStats.mockResolvedValue(blockStatsResult);
			const expectedResult = {
				props: {
					blocks: blockPageResult.data,
					stats: blockStatsResult
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
			render(<BlockList blocks={blockPageResult.data} stats={blockStatsResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			blocksHeight.forEach(height => {
				expect(screen.getByText(height)).toBeInTheDocument();
			});
		};

		it('renders page with the list of blocks on desktop', () => {
			// Act & Assert:
			runTest();
		});

		it('renders page with the list of blocks on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act & Assert:
			runTest();
		});
	});
});
