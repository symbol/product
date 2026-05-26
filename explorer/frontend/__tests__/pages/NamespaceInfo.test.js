import '@testing-library/jest-dom';
import { namespaceInfoResult } from '../test-utils/namespaces';
import * as BlockService from '@/api/blocks';
import * as NamespaceService from '@/api/namespaces';
import NamespaceInfo, { getServerSideProps } from '@/pages/namespaces/[id]';
import { pageConfig } from '@/variants';
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
	const originalNamespaceConfig = { ...pageConfig.namespaces };

	afterEach(() => {
		Object.assign(pageConfig.namespaces, originalNamespaceConfig);
		jest.restoreAllMocks();
	});

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

			// Act + Assert:
			await runTest(namespaceInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const namespaceInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(namespaceInfo, expectedResult);
		});

		it('returns namespace metadata entries when configured', async () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceMetadataSection: true
			});
			const locale = 'en';
			const params = { id: namespaceInfoResult.id };
			const metadataEntries = [
				{
					scopedMetadataKey: 'BB3026E7612A769F',
					senderAddress: 'SENDER_ADDRESS',
					targetAddress: 'TARGET_ADDRESS',
					value: 'metadata value'
				}
			];
			const fetchNamespaceInfo = jest.spyOn(NamespaceService, 'fetchNamespaceInfo');
			fetchNamespaceInfo.mockResolvedValue(namespaceInfoResult);
			const fetchNamespaceMetadataPage = jest.spyOn(NamespaceService, 'fetchNamespaceMetadataPage');
			fetchNamespaceMetadataPage.mockResolvedValue({
				data: metadataEntries,
				pageNumber: 1
			});

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchNamespaceInfo).toHaveBeenCalledWith(params.id);
			expect(fetchNamespaceMetadataPage).toHaveBeenCalledWith({ targetId: namespaceInfoResult.id });
			expect(result).toEqual({
				props: {
					namespaceInfo: namespaceInfoResult,
					metadataEntries
				}
			});
		});

		it('returns namespace balance transfer receipts when configured', async () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceReceiptSection: true
			});
			const locale = 'en';
			const params = { id: namespaceInfoResult.id };
			const balanceTransferReceipts = [
				{
					version: 1,
					type: 'namespaceRentalFee',
					to: 'RECIPIENT_ADDRESS',
					mosaic: {
						id: '72C0212E67A08BCE',
						name: '72C0212E67A08BCE',
						amount: 172.8,
						isNative: true
					}
				}
			];
			const fetchNamespaceInfo = jest.spyOn(NamespaceService, 'fetchNamespaceInfo');
			fetchNamespaceInfo.mockResolvedValue(namespaceInfoResult);
			const fetchNamespaceReceiptPage = jest.spyOn(NamespaceService, 'fetchNamespaceReceiptPage');
			fetchNamespaceReceiptPage.mockResolvedValue({
				data: balanceTransferReceipts,
				pageNumber: 1
			});

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchNamespaceInfo).toHaveBeenCalledWith(params.id);
			expect(fetchNamespaceReceiptPage).toHaveBeenCalledWith({ height: namespaceInfoResult.registrationHeight });
			expect(result).toEqual({
				props: {
					namespaceInfo: namespaceInfoResult,
					balanceTransferReceipts
				}
			});
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
			expect(screen.getByText('month_dec 17, 2021 • 14:14')).toBeInTheDocument();
		});

		it('renders readable namespace name and namespace id without created date when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showReadableNamespaceName: true,
				showNamespaceRegistrationTimestamp: false,
				namespaceIdFieldTitleKey: 'table_field_namespaceId'
			});
			const namespaceInfo = {
				...namespaceInfoResult,
				name: 'B5CEDBDF48C58177',
				id: 'B5CEDBDF48C58177',
				namespaceName: 'who_tdb5g2ev5wflbqvcn5jyjwok2uptocko2x7qeea'
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

			// Assert:
			expect(screen.getByText('field_namespaceName')).toBeInTheDocument();
			expect(screen.getByText(namespaceInfo.namespaceName)).toBeInTheDocument();
			expect(screen.getByText('table_field_namespaceId')).toBeInTheDocument();
			expect(screen.getAllByText(namespaceInfo.id)[0]).toBeInTheDocument();
			expect(screen.queryByText('month_dec 17, 2021 • 14:14')).not.toBeInTheDocument();
		});

		it('renders namespace alias fields and hides sub namespaces when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showSubNamespaces: false,
				showNamespaceAliasFields: true
			});
			const namespaceInfo = {
				...namespaceInfoResult,
				aliasType: 'mosaic',
				aliasMosaicId: '343B5E93242F8C10',
				aliasAddress: null
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

			// Assert:
			expect(screen.queryByText('field_subNamespaces')).not.toBeInTheDocument();
			expect(screen.getByText('field_aliasType')).toBeInTheDocument();
			expect(screen.getByText('value_namespaceAliasType_mosaic')).toBeInTheDocument();
			expect(screen.getByText('field_aliasMosaic')).toBeInTheDocument();
			expect(screen.getByText(namespaceInfo.aliasMosaicId)).toBeInTheDocument();
		});

		it('renders namespace address alias field when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceAliasFields: true
			});
			const namespaceInfo = {
				...namespaceInfoResult,
				aliasType: 'address',
				aliasMosaicId: null,
				aliasAddress: 'ALIAS_ADDRESS'
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

			// Assert:
			expect(screen.getByText('value_namespaceAliasType_address')).toBeInTheDocument();
			expect(screen.getByText('field_aliasAddress')).toBeInTheDocument();
			expect(screen.getByText(namespaceInfo.aliasAddress)).toBeInTheDocument();
		});

		it('renders namespace level section instead of mosaics when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceMosaicSection: false,
				showNamespaceLevelSection: true
			});
			const namespaceInfo = {
				...namespaceInfoResult,
				namespaceLevels: [
					{
						name: 'sub2',
						namespaceId: 'B3F9BD70918F71E7',
						parentId: 'DAF0482B1DA42F1E'
					},
					{
						name: 'sub1',
						namespaceId: 'DAF0482B1DA42F1E',
						parentId: 'C308F07908B26A58'
					},
					{
						name: 'tes1',
						namespaceId: 'C308F07908B26A58',
						parentId: null
					}
				]
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

			// Assert:
			expect(screen.queryByText('section_mosaics')).not.toBeInTheDocument();
			expect(screen.getByText('section_namespaceLevel')).toBeInTheDocument();
			expect(screen.getByText('table_field_namespaceId')).toBeInTheDocument();
			expect(screen.getByText('table_field_parentId')).toBeInTheDocument();
			expect(screen.getByText('sub2')).toBeInTheDocument();
			expect(screen.getByText('B3F9BD70918F71E7')).toBeInTheDocument();
			expect(screen.getAllByText('DAF0482B1DA42F1E')[0]).toBeInTheDocument();
			expect(screen.getByText('value_namespaceAliasType_none')).toBeInTheDocument();
		});

		it('renders namespace metadata entries when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceMetadataSection: true
			});
			const metadataEntries = [
				{
					scopedMetadataKey: 'BB3026E7612A769F',
					senderAddress: 'SENDER_ADDRESS',
					targetAddress: 'TARGET_ADDRESS',
					value: '<img src=x onerror=alert(1)>'
				}
			];
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			const { container } = render(<NamespaceInfo namespaceInfo={namespaceInfoResult} metadataEntries={metadataEntries} />);

			// Assert:
			expect(screen.getByText('section_metadataEntries')).toBeInTheDocument();
			expect(screen.getByText('table_field_scopedMetadataKey')).toBeInTheDocument();
			expect(screen.getByText('table_field_senderAddress')).toBeInTheDocument();
			expect(screen.getByText('table_field_targetAddress')).toBeInTheDocument();
			expect(screen.getByText(metadataEntries[0].scopedMetadataKey)).toBeInTheDocument();
			expect(screen.getByText(metadataEntries[0].senderAddress)).toBeInTheDocument();
			expect(screen.getByText(metadataEntries[0].targetAddress)).toBeInTheDocument();
			expect(screen.getByText(metadataEntries[0].value)).toBeInTheDocument();
			expect(container.querySelector('img[src="x"]')).toBe(null);
		});

		it('renders balance transfer receipt rows when configured', () => {
			// Arrange:
			Object.assign(pageConfig.namespaces, {
				showNamespaceReceiptSection: true
			});
			const balanceTransferReceipts = [
				{
					version: 1,
					type: 'namespaceRentalFee',
					to: 'RECIPIENT_ADDRESS',
					mosaic: {
						id: '72C0212E67A08BCE',
						name: '72C0212E67A08BCE',
						amount: 172.8,
						isNative: true
					}
				}
			];
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<NamespaceInfo namespaceInfo={namespaceInfoResult} balanceTransferReceipts={balanceTransferReceipts} />);

			// Assert:
			expect(screen.getByText('section_balanceTransferReceipt')).toBeInTheDocument();
			expect(screen.getByText('table_field_version')).toBeInTheDocument();
			expect(screen.getByText('table_field_type')).toBeInTheDocument();
			expect(screen.getByText('table_field_to')).toBeInTheDocument();
			expect(screen.getByText('table_field_mosaics')).toBeInTheDocument();
			expect(screen.getByText('receiptType_namespaceRentalFee')).toBeInTheDocument();
			expect(screen.getByText(balanceTransferReceipts[0].to)).toBeInTheDocument();
			expect(screen.getByText('172')).toBeInTheDocument();
			expect(screen.getByText('.8')).toBeInTheDocument();
			expect(screen.getByText('XEM')).toBeInTheDocument();
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

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for expired namespace', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 9999;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expired';

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for namespace which never expire', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 0;
			const isUnlimitedDuration = true;
			const expectedText = 'value_neverExpired';

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});
	});
});
