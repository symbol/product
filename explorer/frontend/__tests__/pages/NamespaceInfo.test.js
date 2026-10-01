import '@testing-library/jest-dom';
import { namespaceInfoResult } from '../test-utils/namespaces';
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
const activeChainHeight = namespaceInfoResult.expirationHeight - remainingBlockCount;
const expiredChainHeight = namespaceInfoResult.expirationHeight + remainingBlockCount;
const expirationCountdownText = `${SCREEN_TEXT.valueExpiration}::value:${remainingBlockCount}`;
const createdTimestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldCreated}`;
const subNamespacesText = namespaceInfoResult.subNamespaces.join(', ');
const namespaceMosaic = namespaceInfoResult.namespaceMosaics[0].data[0];

// Tests

describe('NamespaceInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { namespaceInfo: [NamespaceService, 'fetchNamespaceInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the namespace info',
				config: {
					responses: { namespaceInfo: namespaceInfoResult }
				},
				expected: {
					requestArguments: { namespaceInfo: [namespaceInfoResult.id] },
					result: {
						props: { namespaceInfo: namespaceInfoResult }
					}
				}
			},
			{
				description: 'returns not found when the namespace does not exist',
				config: {
					responses: { namespaceInfo: null }
				},
				expected: {
					requestArguments: { namespaceInfo: [namespaceInfoResult.id] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { id: namespaceInfoResult.id },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render scenarios', () => {
		const renderPage = config => {
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<NamespaceInfo namespaceInfo={{ ...namespaceInfoResult, ...config.namespaceInfo }} />);
		};

		const renderScenarioCases = [
			{
				description: 'namespace section: renders the name and creation info',
				config: {},
				expected: {
					texts: [SCREEN_TEXT.sectionNamespace, SCREEN_TEXT.fieldName],
					// The name and the created title also appear in the mosaics section (group header and table header).
					textOccurrences: {
						[namespaceInfoResult.name]: 2,
						[createdTimestampText]: 2
					}
				}
			},
			{
				description: 'details section: renders the sub namespaces and the creator',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.fieldSubNamespaces,
						subNamespacesText,
						SCREEN_TEXT.fieldCreator,
						namespaceInfoResult.creator
					]
				}
			},
			{
				description: 'details section: renders the expiration countdown and the progress bar for an active namespace',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.fieldExpiration,
						expirationCountdownText,
						SCREEN_TEXT.fieldRegistrationHeight,
						SCREEN_TEXT.fieldExpirationHeight,
						namespaceInfoResult.registrationHeight,
						namespaceInfoResult.expirationHeight
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
						SCREEN_TEXT.fieldRegistrationHeight,
						SCREEN_TEXT.fieldExpirationHeight
					],
					hiddenTexts: [new RegExp(SCREEN_TEXT.valueExpiration), SCREEN_TEXT.valueNeverExpired]
				}
			},
			{
				description: 'details section: renders never expired without the progress bar for an unlimited duration namespace',
				config: { namespaceInfo: { isUnlimitedDuration: true } },
				expected: {
					texts: [SCREEN_TEXT.valueNeverExpired],
					hiddenTexts: [
						SCREEN_TEXT.fieldRegistrationHeight,
						SCREEN_TEXT.fieldExpirationHeight,
						SCREEN_TEXT.valueExpired,
						new RegExp(SCREEN_TEXT.valueExpiration)
					]
				}
			},
			{
				description: 'mosaics section: renders the mosaics grouped by namespace',
				config: {},
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
					textOccurrences: { [namespaceInfoResult.name]: 2 },
					hiddenTexts: [SCREEN_TEXT.messageEmptyTable]
				}
			},
			{
				description: 'mosaics section: renders the empty message when the namespace has no mosaics',
				config: { namespaceInfo: { namespaceMosaics: [] } },
				expected: {
					texts: [SCREEN_TEXT.messageEmptyTable],
					hiddenTexts: [namespaceMosaic.name]
				}
			}
		];

		runRenderScenarioTests({ renderPage, cases: renderScenarioCases });
	});
});
