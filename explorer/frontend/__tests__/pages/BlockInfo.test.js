import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { blockInfoResult } from '../test-utils/blocks';
import * as BlockService from '@/api/blocks';
import BlockInfo, { getServerSideProps } from '@/pages/blocks/[height]';
import * as utils from '@/utils';
import { render, screen } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

describe('BlockInfo', () => {
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
		it('renders page with the information about the block', () => {
			// Arrange:
			const pageSectionText = 'section_block';
			const heightText = blockInfoResult.height;
			const difficultyText = `${blockInfoResult.difficulty} %`;
			const sizeText = `${blockInfoResult.size} B`;
			const harvesterText = blockInfoResult.harvester;

			// Act:
			render(<BlockInfo blockInfo={blockInfoResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(heightText)).toBeInTheDocument();
			expect(screen.getByText(difficultyText)).toBeInTheDocument();
			expect(screen.getByText(sizeText)).toBeInTheDocument();
			expect(screen.getByText(harvesterText)).toBeInTheDocument();
		});

		const runStatusLabelTest = (chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText) => {
			// Arrange:
			const spy = jest.spyOn(utils, 'useAsyncCall');
			spy.mockImplementation(() => blockInfoResult.height + chainHeightOffset);

			// Act:
			render(<BlockInfo blockInfo={blockInfoResult} />);

			// Assert:
			expect(screen.getByText(expectedShownLabelText)).toBeInTheDocument();
			expect(screen.queryByText(expectedHiddenLabelText)).not.toBeInTheDocument();
		};

		it('renders safe label', () => {
			// Arrange:
			const chainHeightOffset = 361;
			const expectedShownLabelText = 'label_safe';
			const expectedHiddenLabelText = 'label_unsafe';

			// Act + Assert:
			runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});

		it('renders created label', () => {
			// Arrange:
			const chainHeightOffset = 100;
			const expectedShownLabelText = 'label_created';
			const expectedHiddenLabelText = 'label_safe';

			// Act + Assert:
			runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});
	});
});
