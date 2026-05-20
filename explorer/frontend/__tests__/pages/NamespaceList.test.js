import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import { namespacePageResult } from '../test-utils/namespaces';
import * as NamespaceService from '@/api/namespaces';
import NamespaceList, { getServerSideProps } from '@/pages/namespaces/index';
import { pageConfig } from '@/variants';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/api/namespaces', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/namespaces')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('NamespaceList', () => {
	const originalShowSubNamespaceCount = pageConfig.namespaces.showSubNamespaceCount;
	const originalShowReadableNamespaceName = pageConfig.namespaces.showReadableNamespaceName;
	const originalShowNamespaceFilter = pageConfig.namespaces.showNamespaceFilter;
	const originalNamespaceIdColumnTitleKey = pageConfig.namespaces.namespaceIdColumnTitleKey;

	beforeEach(() => {
		setDevice('desktop');
		pageConfig.namespaces.showSubNamespaceCount = originalShowSubNamespaceCount;
		pageConfig.namespaces.showReadableNamespaceName = originalShowReadableNamespaceName;
		pageConfig.namespaces.showNamespaceFilter = originalShowNamespaceFilter;
		pageConfig.namespaces.namespaceIdColumnTitleKey = originalNamespaceIdColumnTitleKey;
	});

	afterEach(() => {
		pageConfig.namespaces.showSubNamespaceCount = originalShowSubNamespaceCount;
		pageConfig.namespaces.showReadableNamespaceName = originalShowReadableNamespaceName;
		pageConfig.namespaces.showNamespaceFilter = originalShowNamespaceFilter;
		pageConfig.namespaces.namespaceIdColumnTitleKey = originalNamespaceIdColumnTitleKey;
	});

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

		it('renders sub namespace count column when enabled', () => {
			// Arrange:
			pageConfig.namespaces.showSubNamespaceCount = true;

			// Act:
			render(<NamespaceList namespaces={namespacePageResult.data} />);

			// Assert:
			expect(screen.getByText('table_field_subNamespaceCount')).toBeInTheDocument();
		});

		it('does not render sub namespace count column when disabled', () => {
			// Arrange:
			pageConfig.namespaces.showSubNamespaceCount = false;

			// Act:
			render(<NamespaceList namespaces={namespacePageResult.data} />);

			// Assert:
			expect(screen.queryByText('table_field_subNamespaceCount')).toBeNull();
		});

		it('renders readable namespace name column when enabled', () => {
			// Arrange:
			pageConfig.namespaces.showReadableNamespaceName = true;
			pageConfig.namespaces.namespaceIdColumnTitleKey = 'table_field_namespaceId';
			const namespaces = namespacePageResult.data.map(namespace => ({
				...namespace,
				namespaceName: `readable-${namespace.id}`
			}));

			// Act:
			render(<NamespaceList namespaces={namespaces} />);

			// Assert:
			expect(screen.getByText('table_field_namespaceId')).toBeInTheDocument();
			expect(screen.getByText('table_field_name')).toBeInTheDocument();
			expect(screen.getByText(`readable-${namespacePageResult.data[0].id}`)).toBeInTheDocument();
		});

		it('renders namespace filters when enabled and requests selected filter', async () => {
			// Arrange:
			pageConfig.namespaces.showNamespaceFilter = true;
			const fetchNamespacePage = jest.spyOn(NamespaceService, 'fetchNamespacePage');
			fetchNamespacePage.mockResolvedValue(namespacePageResult);

			// Act:
			render(<NamespaceList namespaces={namespacePageResult.data} />);
			fireEvent.click(screen.getByText('filter_addressAlias'));

			// Assert:
			expect(screen.getByText('filter_recent')).toBeInTheDocument();
			expect(screen.getByText('filter_mosaicAlias')).toBeInTheDocument();
			expect(screen.getByText('filter_rootNamespace')).toBeInTheDocument();
			expect(screen.getByText('filter_subNamespace')).toBeInTheDocument();
			await waitFor(() => expect(fetchNamespacePage).toHaveBeenCalledWith({ isAddressAlias: true, pageNumber: 1 }));
		});

		it('does not render namespace filters when disabled', () => {
			// Arrange:
			pageConfig.namespaces.showNamespaceFilter = false;

			// Act:
			render(<NamespaceList namespaces={namespacePageResult.data} />);

			// Assert:
			expect(screen.queryByText('filter_recent')).toBeNull();
			expect(screen.queryByText('filter_addressAlias')).toBeNull();
		});

		it('renders page with the list of namespaces on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});
	});
});
