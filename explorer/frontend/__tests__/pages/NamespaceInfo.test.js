import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { namespaceInfoResult } from '../test-utils/namespaces';
import * as BlockService from '@/api/blocks';
import * as NamespaceService from '@/api/namespaces';
import NamespaceInfo, { getServerSideProps } from '@/pages/namespaces/[id].jsx';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

jest.mock('@/api/namespaces', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/namespaces')
	};
});

describe('NamespaceInfo', () => {
	describe('getServerSideProps', () => {
		const runTest = async (namespaceInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { id: namespaceInfoResult.id };
			const fetchNamespaceInfo = jest.spyOn(NamespaceService, 'fetchNamespaceInfo');
			fetchNamespaceInfo.mockResolvedValue(namespaceInfo);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchNamespaceInfo).toHaveBeenCalledWith(params.id);
			expect(result).toEqual(expectedResult);
		};

		it('returns namespace info', async () => {
			// Arrange:
			const namespaceInfo = namespaceInfoResult;
			const expectedResult = {
				props: {
					namespaceInfo
				}
			};

			// Act & Assert:
			await runTest(namespaceInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const namespaceInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act & Assert:
			await runTest(namespaceInfo, expectedResult);
		});
	});

	describe('namespace information', () => {
		it('renders page with the information about the namespace', () => {
			// Arrange:
			const namespaceInfo = namespaceInfoResult;
			const pageSectionText = 'section_namespace';
			const namespaceNameText = namespaceInfo.name;
			const mosaicNameText = namespaceInfo.namespaceMosaics[0].data[0].name;
			const creatorText = namespaceInfo.creator;
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

			// Assert:
			const [nameInMainSection, nameInMosaicsSection] = screen.getAllByText(namespaceNameText);
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(mosaicNameText)).toBeInTheDocument();
			expect(nameInMainSection).toBeInTheDocument();
			expect(nameInMosaicsSection).toBeInTheDocument();
			expect(screen.getByText(creatorText)).toBeInTheDocument();
		});
	});

	describe('namespace expiration status', () => {
		const runStatusTest = async (chainHeight, expirationHeight, isUnlimitedDuration, expectedText) => {
			// Arrange:
			const namespaceInfoExpired = {
				...namespaceInfoResult,
				expirationHeight,
				isUnlimitedDuration
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => chainHeight);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfoExpired} />);

			// Assert:
			await waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
		};

		it('renders status for active namespace', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 10001;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expiration';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for expired namespace', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 9999;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expired';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for namespace which never expire', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 0;
			const isUnlimitedDuration = true;
			const expectedText = 'value_neverExpired';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});
	});
});
