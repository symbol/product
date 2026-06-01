import '@testing-library/jest-dom';
import { accountPageResult } from '../test-utils/accounts';
import { mosaicInfoResult } from '../test-utils/mosaics';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/api/accounts';
import * as BlockService from '@/api/blocks';
import * as MosaicMetadataService from '@/api/mosaicMetadata';
import * as MosaicReceiptService from '@/api/mosaicReceipts';
import * as MosaicRestrictionService from '@/api/mosaicRestrictions';
import * as MosaicService from '@/api/mosaics';
import * as TransactionService from '@/api/transactions';
import MosaicInfo, { getServerSideProps } from '@/pages/mosaics/[id]';
import * as utils from '@/utils';
import { pageConfig } from '@/variants';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/accounts')
	};
});

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

jest.mock('@/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaics')
	};
});

jest.mock('@/api/mosaicMetadata', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaicMetadata')
	};
});

jest.mock('@/api/mosaicReceipts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaicReceipts')
	};
});

jest.mock('@/api/mosaicRestrictions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaicRestrictions')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

describe('MosaicInfo', () => {
	const originalMosaicConfig = { ...pageConfig.mosaics };

	beforeEach(() => {
		Object.assign(pageConfig.mosaics, originalMosaicConfig);
	});

	afterEach(() => {
		Object.assign(pageConfig.mosaics, originalMosaicConfig);
		jest.restoreAllMocks();
	});

	describe('getServerSideProps', () => {
		const runTest = async (mosaicInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { id: mosaicInfoResult.id };
			const fetchMosaicInfo = jest.spyOn(MosaicService, 'fetchMosaicInfo');
			fetchMosaicInfo.mockResolvedValue(mosaicInfo);
			const fetchAccountPage = jest.spyOn(AccountService, 'fetchAccountPage');
			fetchAccountPage.mockResolvedValue(accountPageResult);
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchMosaicInfo).toHaveBeenCalledWith(params.id);
			expect(fetchAccountPage).not.toHaveBeenCalled();
			expect(fetchTransactionPage).not.toHaveBeenCalled();
			expect(result).toEqual(expectedResult);
		};

		it('returns mosaic info', async () => {
			// Arrange:
			const mosaicInfo = mosaicInfoResult;
			const expectedResult = {
				props: {
					mosaicInfo,
					preloadedTransactions: [],
					preloadedAccounts: []
				}
			};

			// Act + Assert:
			await runTest(mosaicInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const mosaicInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(mosaicInfo, expectedResult);
		});
	});

	describe('mosaic information', () => {
		it('renders page with the information about the mosaic', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				creator: 'creator-account-address'
			};
			const pageSectionText = 'section_mosaic';
			const mosaicNameText = mosaicInfo.name;
			const creatorText = mosaicInfo.creator;
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText(mosaicNameText)).toBeInTheDocument();
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(creatorText)).toBeInTheDocument();
		});

		it('renders Symbol mosaic id, aliases, and all flags without created fields', () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				nameColumnTitleKey: 'table_field_mosaicId',
				showAlias: true,
				showCreated: false,
				showFlags: true,
				showNamespaceDetail: false,
				showRegistrationHeightDetail: false,
				showUnlimitedExpirationProgress: true
			});
			const mosaicInfo = {
				...mosaicInfoResult,
				id: '6F7904E6DF09D21D',
				name: '6F7904E6DF09D21D',
				aliasNames: ['symbol.alias'],
				isTransferable: true,
				isSupplyMutable: false,
				isRestrictable: true,
				isRevokable: true
			};
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText('table_field_mosaicId')).toBeInTheDocument();
			expect(screen.getByText('6F7904E6DF09D21D')).toBeInTheDocument();
			expect(screen.getByText('table_field_alias')).toBeInTheDocument();
			expect(screen.getByText('symbol.alias')).toHaveAttribute('href', '/namespaces/symbol.alias');
			expect(screen.queryByText('field_created')).not.toBeInTheDocument();
			expect(screen.queryByText('No description')).not.toBeInTheDocument();
			expect(screen.getByText('label_transferable')).toBeInTheDocument();
			expect(screen.getByText('label_supplyMutable')).toBeInTheDocument();
			expect(screen.getByText('label_restrictable')).toBeInTheDocument();
			expect(screen.getByText('label_revokable')).toBeInTheDocument();
			expect(screen.getByText('label_transferable').previousSibling.childNodes[0]).toHaveAttribute('alt', 'true');
			expect(screen.getByText('label_supplyMutable').previousSibling.childNodes[0]).toHaveAttribute('alt', 'false');
			expect(screen.getByText('label_restrictable').previousSibling.childNodes[0]).toHaveAttribute('alt', 'true');
			expect(screen.getByText('label_revokable').previousSibling.childNodes[0]).toHaveAttribute('alt', 'true');
		});

		it('renders Symbol mosaic detail fields without namespace and direct registration height', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showNamespaceDetail: false,
				showRegistrationHeightDetail: false,
				showUnlimitedExpirationProgress: true
			});
			const mosaicInfo = {
				...mosaicInfoResult,
				supply: 10000,
				divisibility: 2,
				creator: 'TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
				registrationHeight: 3391646,
				namespaceRegistrationHeight: null,
				namespaceExpirationHeight: null,
				isUnlimitedDuration: true
			};
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 3391646);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.queryByText('field_mosaic_namespace')).not.toBeInTheDocument();
			expect(screen.getByText('field_supply')).toBeInTheDocument();
			expect(screen.getByText('10000')).toBeInTheDocument();
			expect(screen.getByText('field_divisibility')).toBeInTheDocument();
			expect(screen.getByText('2')).toBeInTheDocument();
			expect(screen.getByText('field_creator')).toBeInTheDocument();
			expect(screen.getByText(mosaicInfo.creator)).toBeInTheDocument();
			expect(screen.queryByText('field_namespaceExpiration')).not.toBeInTheDocument();
			expect(screen.getByText('field_expiration')).toBeInTheDocument();
			await waitFor(() => expect(screen.getAllByText('Infinity')).toHaveLength(2));
			expect(screen.getByText('field_registrationHeight')).toBeInTheDocument();
			expect(screen.getByText('3391646')).toBeInTheDocument();
			expect(screen.getByText('field_expirationHeight')).toBeInTheDocument();
			expect(screen.queryByText('field_namespaceRegistrationHeight')).not.toBeInTheDocument();
			expect(screen.queryByText('field_namespaceExpirationHeight')).not.toBeInTheDocument();
		});

		it('renders Symbol mosaic restriction list above distribution', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showRestrictionList: true
			});
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);
			jest.spyOn(MosaicRestrictionService, 'fetchMosaicRestrictionPage')
				.mockResolvedValueOnce({
					data: [
						{
							compositeHash: 'GLOBAL_COMPOSITE_HASH',
							entryType: 'Mosaic Global Restriction',
							restrictions: '6F7904E6DF09D21D Key 790526 Greater Than Or Equal 2'
						}
					],
					pageNumber: 1
				})
				.mockResolvedValueOnce({
					data: [
						{
							compositeHash: 'ADDRESS_COMPOSITE_HASH',
							entryType: 'Mosaic Address Restriction',
							targetAddress: 'TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
							restrictions: '790526: 10'
						}
					],
					pageNumber: 1
				});
			const mosaicInfo = {
				...mosaicInfoResult,
				id: '6F7904E6DF09D21D'
			};

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText('section_mosaicRestrictionList').compareDocumentPosition(screen.getByText('section_distribution')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('tab_mosaicGlobalRestriction')).toBeInTheDocument();
			expect(screen.getByText('tab_mosaicAddressRestriction')).toBeInTheDocument();
			await waitFor(() => expect(screen.getByText('GLOBAL_COMPOSITE_HASH')).toBeInTheDocument());
			expect(screen.getByText('Mosaic Global Restriction')).toBeInTheDocument();
			expect(screen.getByText('6F7904E6DF09D21D Key 790526 Greater Than Or Equal 2')).toBeInTheDocument();
			fireEvent.click(screen.getByText('tab_mosaicAddressRestriction'));
			await waitFor(() => expect(screen.getByText('ADDRESS_COMPOSITE_HASH')).toBeInTheDocument());
			expect(screen.getByText('Mosaic Address Restriction')).toBeInTheDocument();
			expect(screen.getByText('TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY')).toBeInTheDocument();
			expect(screen.getByText('790526: 10')).toBeInTheDocument();
			expect(MosaicRestrictionService.fetchMosaicRestrictionPage).toHaveBeenNthCalledWith(1, {
				pageNumber: 1,
				mosaicId: '6F7904E6DF09D21D',
				type: 1
			});
			expect(MosaicRestrictionService.fetchMosaicRestrictionPage).toHaveBeenNthCalledWith(2, {
				pageNumber: 1,
				mosaicId: '6F7904E6DF09D21D',
				type: 0
			});
		});

		it('renders Symbol mosaic metadata entries below restriction list', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showMetadataEntries: true,
				showRestrictionList: true
			});
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);
			jest.spyOn(MosaicRestrictionService, 'fetchMosaicRestrictionPage').mockResolvedValue({
				data: [],
				pageNumber: 1
			});
			jest.spyOn(MosaicMetadataService, 'fetchMosaicMetadataPage').mockResolvedValue({
				data: [
					{
						scopedMetadataKey: '0000676E69746172',
						senderAddress: 'TDB5G2EV5WFLBQVCN5JYJWOK2UPTOCKO2X7QEEA',
						targetAddress: 'TBR2EFNIGLKXKWYUOWN2YY7P2LC7QQLPOPPUB6A',
						value: '<script>alert(1)</script>'
					}
				],
				pageNumber: 1
			});
			const mosaicInfo = {
				...mosaicInfoResult,
				id: '37E190650E56B5A7'
			};

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText('section_mosaicRestrictionList').compareDocumentPosition(screen.getByText('section_metadataEntries')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('section_metadataEntries').compareDocumentPosition(screen.getByText('section_distribution')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			await waitFor(() => expect(screen.getByText('0000676E69746172')).toBeInTheDocument());
			expect(screen.getByText('table_field_senderAddress')).toBeInTheDocument();
			expect(screen.getByText('table_field_targetAddress')).toBeInTheDocument();
			expect(screen.getByText('table_field_value')).toBeInTheDocument();
			expect(screen.getByText('TDB5G2EV5WFLBQVCN5JYJWOK2UPTOCKO2X7QEEA')).toBeInTheDocument();
			expect(screen.getByText('TBR2EFNIGLKXKWYUOWN2YY7P2LC7QQLPOPPUB6A')).toBeInTheDocument();
			expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
			expect(MosaicMetadataService.fetchMosaicMetadataPage).toHaveBeenCalledWith({
				pageNumber: 1,
				targetId: '37E190650E56B5A7'
			});
		});

		it('renders Symbol mosaic balance transfer receipts below metadata entries', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showBalanceTransferReceipt: true,
				showMetadataEntries: true
			});
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);
			jest.spyOn(MosaicMetadataService, 'fetchMosaicMetadataPage').mockResolvedValue({
				data: [],
				pageNumber: 1
			});
			jest.spyOn(MosaicReceiptService, 'fetchMosaicReceiptPage').mockResolvedValue({
				data: [
					{
						version: 1,
						type: 'mosaicRentalFee',
						to: 'TB3DHDY4YDE4CNMARLYFZ7USU2OLAI4QFS4IZ6Q',
						mosaic: {
							id: '72C0212E67A08BCE',
							name: '72C0212E67A08BCE',
							amount: 172.8,
							isNative: true
						}
					}
				],
				pageNumber: 1
			});
			jest.spyOn(MosaicReceiptService, 'fetchMosaicArtifactExpiryReceiptPage').mockResolvedValue({
				data: [],
				pageNumber: 1
			});
			const mosaicInfo = {
				...mosaicInfoResult,
				registrationHeight: 3407435
			};

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText('section_metadataEntries').compareDocumentPosition(screen.getByText('section_balanceTransferReceipt')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('section_balanceTransferReceipt').compareDocumentPosition(screen.getByText('section_distribution')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			await waitFor(() => expect(screen.getByText('receiptType_mosaicRentalFee')).toBeInTheDocument());
			expect(screen.getByText('1')).toBeInTheDocument();
			expect(screen.getByText('TB3DHDY4YDE4CNMARLYFZ7USU2OLAI4QFS4IZ6Q')).toBeInTheDocument();
			expect(screen.getByText('172')).toBeInTheDocument();
			expect(screen.getByText('.8')).toBeInTheDocument();
			expect(MosaicReceiptService.fetchMosaicReceiptPage).toHaveBeenCalledWith({
				pageNumber: 1,
				height: 3407435
			});
		});

		it('renders Symbol mosaic artifact expiry receipts below balance transfer receipts when results exist', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showArtifactExpiryReceipt: true,
				showBalanceTransferReceipt: true
			});
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);
			jest.spyOn(MosaicReceiptService, 'fetchMosaicReceiptPage').mockResolvedValue({
				data: [],
				pageNumber: 1
			});
			jest.spyOn(MosaicReceiptService, 'fetchMosaicArtifactExpiryReceiptPage').mockResolvedValue({
				data: [
					{
						version: 1,
						type: 'mosaicExpired',
						artifactId: '54521A62D14B4558'
					}
				],
				pageNumber: 1
			});
			const mosaicInfo = {
				...mosaicInfoResult,
				namespaceExpirationHeight: 3396665
			};

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			await waitFor(() => expect(screen.getByText('section_artifactExpiryReceipt')).toBeInTheDocument());
			const balanceTransferReceiptSection = screen.getByText('section_balanceTransferReceipt');
			const artifactExpiryReceiptSection = screen.getByText('section_artifactExpiryReceipt');

			expect(balanceTransferReceiptSection.compareDocumentPosition(artifactExpiryReceiptSection))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(artifactExpiryReceiptSection.compareDocumentPosition(screen.getByText('section_distribution')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('receiptType_mosaicExpired')).toBeInTheDocument();
			expect(screen.getByText('54521A62D14B4558')).toBeInTheDocument();
			expect(MosaicReceiptService.fetchMosaicArtifactExpiryReceiptPage).toHaveBeenCalledWith({
				pageNumber: 1,
				height: 3396665
			});
		});

		it('does not render Symbol mosaic artifact expiry receipts when there are no results or the request fails', async () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				showArtifactExpiryReceipt: true
			});
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 10000);
			const fetchMosaicArtifactExpiryReceiptPage = jest.spyOn(MosaicReceiptService, 'fetchMosaicArtifactExpiryReceiptPage');
			fetchMosaicArtifactExpiryReceiptPage
				.mockResolvedValueOnce({
					data: [],
					pageNumber: 1
				})
				.mockRejectedValueOnce(new Error('failed'));
			const mosaicInfo = {
				...mosaicInfoResult,
				namespaceExpirationHeight: 3396665
			};

			// Act + Assert:
			const { unmount } = render(<MosaicInfo mosaicInfo={mosaicInfo} />);
			await waitFor(() => expect(fetchMosaicArtifactExpiryReceiptPage).toHaveBeenCalledTimes(1));
			expect(screen.queryByText('section_artifactExpiryReceipt')).not.toBeInTheDocument();
			unmount();

			render(<MosaicInfo mosaicInfo={mosaicInfo} />);
			await waitFor(() => expect(fetchMosaicArtifactExpiryReceiptPage).toHaveBeenCalledTimes(2));
			expect(screen.queryByText('section_artifactExpiryReceipt')).not.toBeInTheDocument();
		});
	});

	describe('mosaic expiration status', () => {
		const runStatusTest = async (chainHeight, namespaceExpirationHeight, isUnlimitedDuration, expectedText) => {
			// Arrange:
			const mosaicInfoExpired = {
				...mosaicInfoResult,
				namespaceExpirationHeight,
				isUnlimitedDuration
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => chainHeight);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfoExpired} />);

			// Assert:
			await waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
		};

		it('renders status for active mosaic', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 10001;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expiration';

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for expired mosaic', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 9999;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expired';

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for mosaic which never expire', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 0;
			const isUnlimitedDuration = true;
			const expectedText = 'value_neverExpired';

			// Act + Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});
	});

	describe('mosaic flags', () => {
		const runFlagTest = async (mosaicInfo, expectedLabelText, expectedIconAlt) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1000);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			const labelTextElement = screen.getByText(expectedLabelText);
			const labelIconElement = labelTextElement.previousSibling.childNodes[0];
			expect(labelTextElement).toBeInTheDocument();
			expect(labelIconElement).toHaveAttribute('alt', expectedIconAlt);
		};

		it('renders positive supply mutable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isSupplyMutable: true
			};
			const expectedLabelText = 'label_supplyMutable';
			const expectedIconAlt = 'true';

			// Act + Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders negative supply mutable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isSupplyMutable: false
			};
			const expectedLabelText = 'label_supplyMutable';
			const expectedIconAlt = 'false';

			// Act + Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders positive transferable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isTransferable: true
			};
			const expectedLabelText = 'label_transferable';
			const expectedIconAlt = 'true';

			// Act + Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders negative transferable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isTransferable: false
			};
			const expectedLabelText = 'label_transferable';
			const expectedIconAlt = 'false';

			// Act + Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});
	});

	describe('mosaic distribution', () => {
		const runDistributionTest = async (tabToPress, expectedTextList) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1);
			const mosaicInfo = mosaicInfoResult;
			const preloadedTransactions = transactionPageResult.data;
			const preloadedAccounts = accountPageResult.data;

			// Act:
			render(<MosaicInfo
				mosaicInfo={mosaicInfo}
				preloadedTransactions={preloadedTransactions}
				preloadedAccounts={preloadedAccounts}
			/>);
			fireEvent.click(await screen.findByText(tabToPress));

			// Assert:
			const assertionPromises = expectedTextList.map(expectedText => {
				return waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
			});
			await Promise.all(assertionPromises);
		};

		it('renders holders tab', async () => {
			// Arrange:
			const tabToPress = 'section_holders';
			const expectedTextList = [
				'table_field_address',
				'table_field_balance',
				...accountPageResult.data.map(account => account.address)
			];

			// Act + Assert:
			await runDistributionTest(tabToPress, expectedTextList);
		});

		it('renders transfers tab', async () => {
			// Arrange:
			const tabToPress = 'section_transfers';
			const expectedTextList = [
				'table_field_hash',
				'table_field_type',
				'table_field_sender',
				'table_field_recipient',
				...transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'))
			];

			// Act + Assert:
			await runDistributionTest(tabToPress, expectedTextList);
		});
	});

	describe('mosaic description', () => {
		const runDescriptionTest = (mosaicInfo, expectedText) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText(expectedText)).toBeInTheDocument();
		};

		it('renders description', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				description: 'mosaic-description'
			};
			const expectedText = mosaicInfo.description;

			// Act + Assert:
			runDescriptionTest(mosaicInfo, expectedText);
		});

		it('renders no description', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				description: ''
			};
			const expectedText = 'No description';

			// Act + Assert:
			runDescriptionTest(mosaicInfo, expectedText);
		});
	});
});
