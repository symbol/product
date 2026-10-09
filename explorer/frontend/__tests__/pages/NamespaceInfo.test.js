import '@testing-library/jest-dom';
import { namespace, namespaceWithMosaics, nativeNamespace } from '../../__fixtures__/local/namespace';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as BlockService from '@/app/api/blocks';
import * as NamespaceService from '@/app/api/namespaces';
import NamespaceInfo, { getServerSideProps } from '@/app/pages/namespaces/[id]';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/namespaces', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/namespaces')
	};
});

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

beforeEach(() => {
	jest.spyOn(BlockService, 'fetchChainHight').mockResolvedValue(activeChainHeight);
});

// Constants

const SCREEN_TEXT = {
	sectionNamespace: 'section_namespace',
	sectionMosaics: 'section_mosaics',
	fieldName: 'field_name',
	fieldCreated: 'field_created',
	fieldTimestampUTC: 'field_timestampUTC',
	fieldSubNamespaces: 'field_subNamespaces',
	fieldCreator: 'field_creator',
	fieldExpiration: 'field_expiration',
	fieldRegistrationHeight: 'field_registrationHeight',
	fieldExpirationHeight: 'field_expirationHeight',
	valueExpiration: 'value_expiration',
	valueExpired: 'value_expired',
	valueNeverExpired: 'value_neverExpired',
	tableFieldName: 'table_field_name',
	tableFieldSupply: 'table_field_supply',
	tableFieldRegistrationHeight: 'table_field_registrationHeight',
	messageEmptyTable: 'message_emptyTable'
};

const remainingBlockCount = 500;
const activeChainHeight = namespaceWithMosaics.expirationHeight - remainingBlockCount;
const expiredChainHeight = namespaceWithMosaics.expirationHeight + remainingBlockCount;
const remainingBlocksText = `${SCREEN_TEXT.valueExpiration}::value:${remainingBlockCount}`;
const createdTimestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldCreated}`;
const subNamespacesText = namespace.subNamespaces.join(', ');
const namespaceMosaic = namespaceWithMosaics.namespaceMosaics[0].data[0];

// Tests

describe('NamespaceInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { namespaceInfo: [NamespaceService, 'fetchNamespaceInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the namespace info props',
				config: {
					responses: { namespaceInfo: namespaceWithMosaics }
				},
				expected: {
					requestArguments: { namespaceInfo: [namespaceWithMosaics.id] },
					result: {
						props: { namespaceInfo: namespaceWithMosaics }
					}
				}
			},
			{
				description: 'returns not found when the namespace does not exist',
				config: {
					responses: { namespaceInfo: null }
				},
				expected: {
					requestArguments: { namespaceInfo: [namespaceWithMosaics.id] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { id: namespaceWithMosaics.id },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<NamespaceInfo namespaceInfo={config.namespaceInfo} />);
		};

		describe('section: namespace', () => {
			const namespaceCases = [
				{
					description: 'renders the name and creation info',
					config: { namespaceInfo: namespaceWithMosaics },
					expected: {
						texts: [SCREEN_TEXT.sectionNamespace, SCREEN_TEXT.fieldName],
						// The name and the created title also appear in the mosaics section (group header and table header).
						textOccurrences: {
							[namespaceWithMosaics.name]: 2,
							[createdTimestampText]: 2
						}
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: namespaceCases });
		});

		describe('section: details', () => {
			const detailsCases = [
				{
					description: 'renders the sub namespaces and the creator',
					config: { namespaceInfo: namespace },
					expected: {
						texts: [
							SCREEN_TEXT.fieldSubNamespaces,
							subNamespacesText,
							SCREEN_TEXT.fieldCreator,
							namespace.creator
						]
					}
				},
				{
					description: 'renders the remaining blocks and progress bar when the chain height is below the expiration height',
					config: { namespaceInfo: namespaceWithMosaics },
					expected: {
						texts: [
							SCREEN_TEXT.fieldExpiration,
							remainingBlocksText,
							SCREEN_TEXT.fieldRegistrationHeight,
							SCREEN_TEXT.fieldExpirationHeight,
							namespaceWithMosaics.registrationHeight,
							namespaceWithMosaics.expirationHeight
						],
						hiddenTexts: [SCREEN_TEXT.valueExpired, SCREEN_TEXT.valueNeverExpired]
					}
				},
				{
					description: 'renders the expired state when the chain height is above the expiration height',
					config: {
						namespaceInfo: namespaceWithMosaics,
						chainHeight: expiredChainHeight
					},
					expected: {
						texts: [
							SCREEN_TEXT.valueExpired,
							SCREEN_TEXT.fieldRegistrationHeight,
							SCREEN_TEXT.fieldExpirationHeight
						],
						hiddenTexts: [new RegExp(SCREEN_TEXT.valueExpiration), SCREEN_TEXT.valueNeverExpired]
					}
				},
				{
					description: 'renders the never expired value without the progress bar when the namespace has an unlimited duration',
					config: { namespaceInfo: nativeNamespace },
					expected: {
						texts: [SCREEN_TEXT.valueNeverExpired],
						hiddenTexts: [
							SCREEN_TEXT.fieldRegistrationHeight,
							SCREEN_TEXT.fieldExpirationHeight,
							SCREEN_TEXT.valueExpired,
							new RegExp(SCREEN_TEXT.valueExpiration)
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: detailsCases });
		});

		describe('section: mosaics', () => {
			const mosaicsCases = [
				{
					description: 'renders the mosaics grouped by namespace',
					config: { namespaceInfo: namespaceWithMosaics },
					expected: {
						texts: [
							SCREEN_TEXT.sectionMosaics,
							SCREEN_TEXT.tableFieldName,
							SCREEN_TEXT.tableFieldSupply,
							SCREEN_TEXT.tableFieldRegistrationHeight,
							namespaceMosaic.name,
							namespaceMosaic.supply,
							namespaceMosaic.registrationHeight
						],
						textOccurrences: { [namespaceWithMosaics.name]: 2 },
						hiddenTexts: [SCREEN_TEXT.messageEmptyTable]
					}
				},
				{
					description: 'renders the empty message when the namespace has no mosaics',
					config: { namespaceInfo: namespace },
					expected: { texts: [SCREEN_TEXT.messageEmptyTable] }
				}
			];

			runRenderScenarioTests({ renderPage, cases: mosaicsCases });
		});
	});
});
