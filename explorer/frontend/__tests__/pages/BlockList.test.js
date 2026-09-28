import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { setDevice } from '../test-utils/device';
import { blockStatisticsResult } from '../test-utils/stats';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import BlockList, { getServerSideProps } from '@/app/pages/blocks/index';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

		it('returns retryable props without fetching statistics when the list request fails', async () => {
			// Arrange:
			const locale = 'en';
			const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage').mockRejectedValueOnce(Error('block list unavailable'));
			const fetchBlockStats = jest.spyOn(StatsService, 'fetchBlockStats');
			const expectedBlockPage = { data: [], pageNumber: 1, isLastPage: false, nextPageParams: null };

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchBlockPage).toHaveBeenCalledWith();
			expect(fetchBlockStats).not.toHaveBeenCalled();
			expect(result).toEqual({
				props: {
					blocks: [],
					blockPage: expectedBlockPage,
					isBlockPageError: true,
					stats: null
				}
			});
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

		it('renders the block list without statistics when stats are unavailable', () => {
			// Arrange:
			const props = { blocks: blockPageResult.data, stats: null };

			// Act:
			render(<BlockList {...props} />);

			// Assert:
			expect(screen.getByText('section_blocks')).toBeInTheDocument();
			expect(screen.getByText(blockPageResult.data[0].height)).toBeInTheDocument();
			expect(screen.queryByText('field_blockGenerationTime')).not.toBeInTheDocument();
			expect(screen.queryByText('field_averageFee')).not.toBeInTheDocument();
			expect(screen.queryByText('field_difficulty')).not.toBeInTheDocument();
		});

		it('retries the initial list after an SSR failure and renders the recovered blocks', async () => {
			// Arrange:
			const failedProps = {
				blocks: [],
				blockPage: { data: [], pageNumber: 1, isLastPage: false, nextPageParams: null },
				isBlockPageError: true,
				stats: null
			};
			const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage').mockResolvedValue(blockPageResult);

			// Act:
			render(<BlockList {...failedProps} />);
			fireEvent.click(screen.getByText('button_tryAgain'));
			await waitFor(() => expect(fetchBlockPage).toHaveBeenCalledTimes(1));

			// Assert:
			expect(fetchBlockPage).toHaveBeenCalledWith({ pageNumber: 1 });
			expect(screen.getByText(blockPageResult.data[0].height)).toBeInTheDocument();
			expect(screen.queryByText('button_tryAgain')).not.toBeInTheDocument();
		});
	});
});
