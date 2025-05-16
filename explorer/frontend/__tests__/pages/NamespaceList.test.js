import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import { namespacePageResult } from '../test-utils/namespaces';
import * as NamespaceService from '@/api/nem/namespaces';
import NamespaceList, { getServerSideProps } from '@/pages/namespaces/index';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/nem/namespaces', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nem/namespaces')
	};
});

jest.mock('@/api/nem/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nem/stats')
	};
});

describe('NamespaceList', () => {
	describe('getServerSideProps', () => {
		it('fetches namespace list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchNamespacePage = jest.spyOn(NamespaceService, 'fetchNamespacePage');
			fetchNamespacePage.mockResolvedValue(namespacePageResult);
			const expectedResult = {
				props: {
					namespaces: namespacePageResult.data
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchNamespacePage).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_namespaces';
			const namespaceIds = namespacePageResult.data.map(namespace => namespace.id);

			// Act:
			render(<NamespaceList namespaces={namespacePageResult.data} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			namespaceIds.forEach(id => {
				expect(screen.getByText(id)).toBeInTheDocument();
			});
		};

		it('renders page with the list of namespaces on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of namespaces on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});
	});
});
