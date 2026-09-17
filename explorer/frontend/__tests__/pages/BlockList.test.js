import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { setDevice } from '../test-utils/device';
import { blockStatisticsResult } from '../test-utils/stats';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import BlockList, { getServerSideProps } from '@/app/pages/blocks/index';
import { render, screen } from '@testing-library/react';

const describeNem = process.env.NEXT_PUBLIC_EXPLORER_VARIANT === 'nem' ? describe : describe.skip;

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

describeNem('BlockList', () => {
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
					blockPage: blockPageResult,
					isBlockPageError: false,
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
			expect(screen.getByText(blockPageResult.data[0].height).closest('a')).toHaveAttribute(
				'href',
				`/blocks/${blockPageResult.data[0].height}`
			);
			expect(screen.getByText(blockPageResult.data[0].harvester).closest('a')).toHaveAttribute(
				'href',
				`/accounts/${blockPageResult.data[0].harvester}`
			);
			expect(document.querySelector('a[href="/mosaics/nem.xem"]')).toBeInTheDocument();
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
	});
});
