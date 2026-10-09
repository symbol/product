import '@testing-library/jest-dom';
import { accountRichList } from '../../__fixtures__/local/account-list';
import { customMosaic, customMosaicWithLevy, nativeMosaic } from '../../__fixtures__/local/mosaic';
import { transactionListConfirmed } from '../../__fixtures__/local/transaction-list-confirmed';
import { clickText, runGetServerSidePropsTests, runRenderScenarioTests, runTableErrorTest } from '../test-utils/page';
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
	noDescription: 'No description'
};

const remainingBlockCount = 500;
const activeChainHeight = customMosaic.namespaceExpirationHeight - remainingBlockCount;
const expiredChainHeight = customMosaic.namespaceExpirationHeight + remainingBlockCount;
const remainingBlocksText = `${SCREEN_TEXT.valueExpiration}::value:${remainingBlockCount}`;
const createdTimestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldCreated}`;
const mosaicSearchCriteria = {
	pageNumber: 1,
	mosaic: customMosaic.id
};
const emptyPage = {
	data: [],
	pageNumber: 1
};
const holdersPage = {
	data: accountRichList,
	pageNumber: 1
};
const transfersPage = {
	data: transactionListConfirmed.filter(transaction => transaction.value.some(mosaic => mosaic.id === customMosaic.id)),
	pageNumber: 1
};

// Tests

describe('MosaicInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { mosaicInfo: [MosaicService, 'fetchMosaicInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the mosaic info and empty preloaded lists props',
				config: {
					responses: { mosaicInfo: customMosaic }
				},
				expected: {
					requestArguments: { mosaicInfo: [customMosaic.id] },
					result: {
						props: {
							mosaicInfo: customMosaic,
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
					requestArguments: { mosaicInfo: [customMosaic.id] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { id: customMosaic.id },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<MosaicInfo mosaicInfo={config.mosaicInfo} preloadedTransactions={[]} preloadedAccounts={[]} />);
		};

		describe('section: mosaic', () => {
			const mosaicCases = [
				{
					description: 'renders the name, labels and description',
					config: { mosaicInfo: customMosaic },
					expected: {
						texts: [
							SCREEN_TEXT.sectionMosaic,
							SCREEN_TEXT.fieldName,
							customMosaic.name,
							createdTimestampText,
							SCREEN_TEXT.labelTransferable,
							SCREEN_TEXT.labelSupplyMutable,
							customMosaic.description
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
					description: 'renders the description placeholder when the description is missing',
					config: {
						mosaicInfo: {
							...customMosaic,
							description: null
						}
					},
					expected: {
						texts: [SCREEN_TEXT.noDescription],
						hiddenTexts: [customMosaic.description]
					}
				},
				{
					description: 'renders danger icons when the mosaic is non-transferable and has a fixed supply',
					config: {
						mosaicInfo: {
							...customMosaic,
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
				}
			];

			runRenderScenarioTests({ renderPage, cases: mosaicCases });
		});

		describe('section: details', () => {
			const detailsCases = [
				{
					description: 'renders the namespace, supply and registration fields',
					config: { mosaicInfo: customMosaic },
					expected: {
						texts: [
							SCREEN_TEXT.fieldMosaicNamespace,
							customMosaic.rootNamespaceName,
							SCREEN_TEXT.fieldSupply,
							customMosaic.supply,
							SCREEN_TEXT.fieldDivisibility,
							customMosaic.divisibility,
							SCREEN_TEXT.fieldCreator,
							customMosaic.creator,
							SCREEN_TEXT.fieldRegistrationHeight,
							customMosaic.registrationHeight
						]
					}
				},
				{
					description: 'renders the remaining blocks and progress bar when the chain height is below the expiration height',
					config: { mosaicInfo: customMosaic },
					expected: {
						texts: [
							SCREEN_TEXT.fieldNamespaceExpiration,
							remainingBlocksText,
							SCREEN_TEXT.fieldNamespaceRegistrationHeight,
							SCREEN_TEXT.fieldNamespaceExpirationHeight,
							customMosaic.namespaceRegistrationHeight,
							customMosaic.namespaceExpirationHeight
						],
						hiddenTexts: [SCREEN_TEXT.valueExpired, SCREEN_TEXT.valueNeverExpired]
					}
				},
				{
					description: 'renders the expired state when the chain height is above the expiration height',
					config: {
						mosaicInfo: customMosaic,
						chainHeight: expiredChainHeight
					},
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
					description: 'renders the never expired text without the progress bar when the mosaic has an unlimited duration',
					config: { mosaicInfo: nativeMosaic },
					expected: {
						texts: [SCREEN_TEXT.valueNeverExpired],
						hiddenTexts: [
							SCREEN_TEXT.fieldNamespaceRegistrationHeight,
							SCREEN_TEXT.fieldNamespaceExpirationHeight,
							SCREEN_TEXT.valueExpired,
							new RegExp(SCREEN_TEXT.valueExpiration)
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: detailsCases });
		});

		describe('section: associated data', () => {
			const associatedDataCases = [
				{
					description: 'renders the levy fields when the mosaic has a levy',
					config: { mosaicInfo: customMosaicWithLevy },
					expected: {
						texts: [
							SCREEN_TEXT.sectionAssociatedData,
							SCREEN_TEXT.fieldLevyType,
							customMosaicWithLevy.levy.type,
							SCREEN_TEXT.fieldLevyMosaic,
							customMosaicWithLevy.levy.mosaic,
							SCREEN_TEXT.fieldLevyFee,
							customMosaicWithLevy.levy.fee,
							SCREEN_TEXT.fieldLevyRecipient
						],
						// The fixture levy recipient is the creator, so the address appears in both fields.
						textOccurrences: { [customMosaicWithLevy.creator]: 2 }
					}
				},
				{
					description: 'does not render the associated data section when the mosaic has no levy',
					config: { mosaicInfo: customMosaic },
					expected: {
						hiddenTexts: [SCREEN_TEXT.sectionAssociatedData, SCREEN_TEXT.fieldLevyType]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: associatedDataCases });
		});

		describe('section: distribution', () => {
			const renderMosaicInfo = () =>
				render(<MosaicInfo mosaicInfo={customMosaic} preloadedTransactions={[]} preloadedAccounts={[]} />);

			it('requests the mosaic holders and transfers', async () => {
				// Act:
				renderMosaicInfo();

				// Assert:
				await waitFor(() => expect(AccountService.fetchAccountPage).toHaveBeenCalledWith(mosaicSearchCriteria));
				await waitFor(() => expect(TransactionService.fetchTransactionPage).toHaveBeenCalledWith(mosaicSearchCriteria));
			});

			describe('tabs', () => {
				const renderPageWithData = () => {
					AccountService.fetchAccountPage.mockResolvedValue(holdersPage);
					TransactionService.fetchTransactionPage.mockResolvedValue(transfersPage);
					renderMosaicInfo();
				};

				const distributionTabCases = [
					{
						description: 'renders the holder addresses when the holders tab is selected',
						config: { actions: [clickText(SCREEN_TEXT.sectionHolders)] },
						expected: {
							texts: [SCREEN_TEXT.sectionDistribution],
							asyncTexts: holdersPage.data.map(account => account.address)
						}
					},
					{
						description: 'renders the transfer hashes when the transfers tab is selected',
						config: { actions: [clickText(SCREEN_TEXT.sectionTransfers)] },
						expected: {
							texts: [SCREEN_TEXT.sectionDistribution],
							asyncTexts: transfersPage.data.map(transaction => truncateString(transaction.hash, 'hash'))
						}
					}
				];

				runRenderScenarioTests({ renderPage: renderPageWithData, cases: distributionTabCases });
			});

			runTableErrorTest('renders the try-again action when the holders request fails', {
				renderPage: renderMosaicInfo,
				request: [AccountService, 'fetchAccountPage']
			});

			runTableErrorTest('renders the try-again action when the transfers request fails', {
				renderPage: () => {
					renderMosaicInfo();
					fireEvent.click(screen.getByText(SCREEN_TEXT.sectionTransfers));
				},
				request: [TransactionService, 'fetchTransactionPage']
			});
		});
	});
});
