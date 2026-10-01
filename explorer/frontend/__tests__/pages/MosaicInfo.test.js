import '@testing-library/jest-dom';
import { accountPageMosaicFilterResult } from '../test-utils/accounts';
import { mosaicInfoResult } from '../test-utils/mosaics';
import { clickText, runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/app/api/accounts';
import * as BlockService from '@/app/api/blocks';
import * as MosaicService from '@/app/api/mosaics';
import * as TransactionService from '@/app/api/transactions';
import MosaicInfo, { getServerSideProps } from '@/app/pages/mosaics/[id]';
import { truncateString } from '@/app/utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/mosaics')
	};
});

jest.mock('@/app/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/accounts')
	};
});

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

beforeEach(() => {
	jest.spyOn(AccountService, 'fetchAccountPage').mockResolvedValue(emptyPage);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(emptyPage);
	jest.spyOn(BlockService, 'fetchChainHight').mockResolvedValue(activeChainHeight);
});

// Constants

const SCREEN_TEXT = {
	sectionMosaic: 'section_mosaic',
	sectionAssociatedData: 'section_associatedData',
	sectionDistribution: 'section_distribution',
	sectionHolders: 'section_holders',
	sectionTransfers: 'section_transfers',
	fieldName: 'field_name',
	fieldCreated: 'field_created',
	fieldTimestampUTC: 'field_timestampUTC',
	fieldMosaicNamespace: 'field_mosaic_namespace',
	fieldSupply: 'field_supply',
	fieldDivisibility: 'field_divisibility',
	fieldCreator: 'field_creator',
	fieldRegistrationHeight: 'field_registrationHeight',
	fieldNamespaceExpiration: 'field_namespaceExpiration',
	fieldNamespaceRegistrationHeight: 'field_namespaceRegistrationHeight',
	fieldNamespaceExpirationHeight: 'field_namespaceExpirationHeight',
	fieldLevyType: 'field_levyType',
	fieldLevyMosaic: 'field_levyMosaic',
	fieldLevyFee: 'field_levyFee',
	fieldLevyRecipient: 'field_levyRecipient',
	labelTransferable: 'label_transferable',
	labelSupplyMutable: 'label_supplyMutable',
	valueExpiration: 'value_expiration',
	valueExpired: 'value_expired',
	valueNeverExpired: 'value_neverExpired',
	noDescription: 'No description',
	buttonTryAgain: 'button_tryAgain'
};

const remainingBlockCount = 500;
const activeChainHeight = mosaicInfoResult.namespaceExpirationHeight - remainingBlockCount;
const expiredChainHeight = mosaicInfoResult.namespaceExpirationHeight + remainingBlockCount;
const expirationCountdownText = `${SCREEN_TEXT.valueExpiration}::value:${remainingBlockCount}`;
const createdTimestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldCreated}`;
const mosaicSearchCriteria = {
	pageNumber: 1,
	mosaic: mosaicInfoResult.id
};
const emptyPage = {
	data: [],
	pageNumber: 1
};

// Tests

describe('MosaicInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { mosaicInfo: [MosaicService, 'fetchMosaicInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the mosaic info and empty preloaded lists',
				config: {
					responses: { mosaicInfo: mosaicInfoResult }
				},
				expected: {
					requestArguments: { mosaicInfo: [mosaicInfoResult.id] },
					result: {
						props: {
							mosaicInfo: mosaicInfoResult,
							preloadedTransactions: [],
							preloadedAccounts: []
						}
					}
				}
			},
			{
				description: 'returns not found when the mosaic does not exist',
				config: {
					responses: { mosaicInfo: null }
				},
				expected: {
					requestArguments: { mosaicInfo: [mosaicInfoResult.id] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { id: mosaicInfoResult.id },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render scenarios', () => {
		const renderPage = config => {
			const mosaicInfo = { ...mosaicInfoResult, ...config.mosaicInfo };
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<MosaicInfo mosaicInfo={mosaicInfo} preloadedTransactions={[]} preloadedAccounts={[]} />);
		};

		const renderScenarioCases = [
			{
				description: 'mosaic section: renders the name, labels and description',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.sectionMosaic,
						SCREEN_TEXT.fieldName,
						mosaicInfoResult.name,
						createdTimestampText,
						SCREEN_TEXT.labelTransferable,
						SCREEN_TEXT.labelSupplyMutable,
						mosaicInfoResult.description
					],
					// Both the transferable and the supply mutable labels render the positive icon.
					altOccurrences: {
						true: 2,
						false: 0
					},
					hiddenTexts: [SCREEN_TEXT.noDescription]
				}
			},
			{
				description: 'mosaic section: renders the description placeholder when the description is missing',
				config: { mosaicInfo: { description: null } },
				expected: {
					texts: [SCREEN_TEXT.noDescription],
					hiddenTexts: [mosaicInfoResult.description]
				}
			},
			{
				description: 'mosaic section: renders danger icons for a non-transferable, fixed-supply mosaic',
				config: {
					mosaicInfo: {
						isTransferable: false,
						isSupplyMutable: false
					}
				},
				expected: {
					altOccurrences: {
						true: 0,
						false: 2
					}
				}
			},
			{
				description: 'details section: renders the namespace, supply and registration fields',
				config: { mosaicInfo: { levy: null } },
				expected: {
					texts: [
						SCREEN_TEXT.fieldMosaicNamespace,
						mosaicInfoResult.rootNamespaceName,
						SCREEN_TEXT.fieldSupply,
						mosaicInfoResult.supply,
						SCREEN_TEXT.fieldDivisibility,
						mosaicInfoResult.divisibility,
						SCREEN_TEXT.fieldCreator,
						mosaicInfoResult.creator,
						SCREEN_TEXT.fieldRegistrationHeight,
						mosaicInfoResult.registrationHeight
					]
				}
			},
			{
				description: 'details section: renders the expiration countdown and the progress bar for an active namespace',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.fieldNamespaceExpiration,
						expirationCountdownText,
						SCREEN_TEXT.fieldNamespaceRegistrationHeight,
						SCREEN_TEXT.fieldNamespaceExpirationHeight,
						mosaicInfoResult.namespaceRegistrationHeight,
						mosaicInfoResult.namespaceExpirationHeight
					],
					hiddenTexts: [SCREEN_TEXT.valueExpired, SCREEN_TEXT.valueNeverExpired]
				}
			},
			{
				description: 'details section: renders the expired state for an expired namespace',
				config: { chainHeight: expiredChainHeight },
				expected: {
					texts: [
						SCREEN_TEXT.valueExpired,
						SCREEN_TEXT.fieldNamespaceRegistrationHeight,
						SCREEN_TEXT.fieldNamespaceExpirationHeight
					],
					hiddenTexts: [new RegExp(SCREEN_TEXT.valueExpiration), SCREEN_TEXT.valueNeverExpired]
				}
			},
			{
				description: 'details section: renders never expired without the progress bar for an unlimited duration mosaic',
				config: { mosaicInfo: { isUnlimitedDuration: true } },
				expected: {
					texts: [SCREEN_TEXT.valueNeverExpired],
					hiddenTexts: [
						SCREEN_TEXT.fieldNamespaceRegistrationHeight,
						SCREEN_TEXT.fieldNamespaceExpirationHeight,
						SCREEN_TEXT.valueExpired,
						new RegExp(SCREEN_TEXT.valueExpiration)
					]
				}
			},
			{
				description: 'associated data section: renders the levy fields for a mosaic with levy',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.sectionAssociatedData,
						SCREEN_TEXT.fieldLevyType,
						mosaicInfoResult.levy.type,
						SCREEN_TEXT.fieldLevyMosaic,
						mosaicInfoResult.levy.mosaic,
						SCREEN_TEXT.fieldLevyFee,
						mosaicInfoResult.levy.fee,
						SCREEN_TEXT.fieldLevyRecipient
					],
					// The fixture levy recipient is the creator, so the address appears in both fields.
					textOccurrences: { [mosaicInfoResult.creator]: 2 }
				}
			},
			{
				description: 'associated data section: is not rendered for a mosaic without levy',
				config: { mosaicInfo: { levy: null } },
				expected: {
					hiddenTexts: [SCREEN_TEXT.sectionAssociatedData, SCREEN_TEXT.fieldLevyType]
				}
			}
		];

		runRenderScenarioTests({ renderPage, cases: renderScenarioCases });
	});

	describe('distribution', () => {
		const renderMosaicInfo = () =>
			render(<MosaicInfo mosaicInfo={mosaicInfoResult} preloadedTransactions={[]} preloadedAccounts={[]} />);

		it('requests holders and transfers with the mosaic filter', async () => {
			// Act:
			renderMosaicInfo();

			// Assert:
			await waitFor(() => expect(AccountService.fetchAccountPage).toHaveBeenCalledWith(mosaicSearchCriteria));
			await waitFor(() => expect(TransactionService.fetchTransactionPage).toHaveBeenCalledWith(mosaicSearchCriteria));
		});

		describe('distribution tabs', () => {
			const renderPage = () => {
				AccountService.fetchAccountPage.mockResolvedValue(accountPageMosaicFilterResult);
				TransactionService.fetchTransactionPage.mockResolvedValue(transactionPageResult);
				renderMosaicInfo();
			};

			const distributionTabCases = [
				{
					description: 'renders the holders tab',
					config: { actions: [clickText(SCREEN_TEXT.sectionHolders)] },
					expected: {
						texts: [SCREEN_TEXT.sectionDistribution],
						asyncTexts: accountPageMosaicFilterResult.data.map(account => account.address)
					}
				},
				{
					description: 'renders the transfers tab',
					config: { actions: [clickText(SCREEN_TEXT.sectionTransfers)] },
					expected: {
						texts: [SCREEN_TEXT.sectionDistribution],
						asyncTexts: transactionPageResult.data.map(transaction => truncateString(transaction.hash, 'hash'))
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: distributionTabCases });
		});

		it('shows the try-again action when the holders request fails', async () => {
			// Arrange: silence the pagination error log.
			jest.spyOn(console, 'error').mockImplementation();
			AccountService.fetchAccountPage.mockRejectedValue(new Error('holders request failed'));

			// Act:
			renderMosaicInfo();

			// Assert:
			await waitFor(() => expect(screen.getByText(SCREEN_TEXT.buttonTryAgain)).toBeInTheDocument());
		});

		it('shows the try-again action when the transfers request fails', async () => {
			// Arrange: silence the pagination error log.
			jest.spyOn(console, 'error').mockImplementation();
			TransactionService.fetchTransactionPage.mockRejectedValue(new Error('transfers request failed'));

			// Act:
			renderMosaicInfo();
			fireEvent.click(screen.getByText(SCREEN_TEXT.sectionTransfers));

			// Assert:
			await waitFor(() => expect(screen.getByText(SCREEN_TEXT.buttonTryAgain)).toBeInTheDocument());
		});
	});
});
