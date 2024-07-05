import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { setDevice } from '../test-utils/device';
import { mosaicPageResult } from '../test-utils/mosaics';
import * as MosaicService from '@/api/mosaics';
import MosaicList, { getServerSideProps } from '@/pages/mosaics/index';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaics')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('MosaicList', () => {
	describe('getServerSideProps', () => {
		it('fetches mosaic list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchMosaicPage = jest.spyOn(MosaicService, 'fetchMosaicPage');
			fetchMosaicPage.mockResolvedValue(mosaicPageResult);
			const expectedResult = {
				props: {
					mosaics: mosaicPageResult.data
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchMosaicPage).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_mosaics';
			const mosaicIds = mosaicPageResult.data.map(mosaic => mosaic.id);

			// Act:
			render(<MosaicList mosaics={mosaicPageResult.data} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			mosaicIds.forEach(id => {
				expect(screen.getByText(id)).toBeInTheDocument();
			});
		};

		it('renders page with the list of mosaics on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of mosaics on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});
	});
});
