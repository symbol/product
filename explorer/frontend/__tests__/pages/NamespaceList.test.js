import '@testing-library/jest-dom';
import { namespace, nativeNamespace } from '../../__fixtures__/local/namespace';
import { namespaceList } from '../../__fixtures__/local/namespace-list';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as BlockService from '@/app/api/blocks';
import * as NamespaceService from '@/app/api/namespaces';
import NamespaceList, { getServerSideProps } from '@/app/pages/namespaces';
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
	sectionNamespaces: 'section_namespaces',
	tableFieldName: 'table_field_name',
	tableFieldSubNamespaceCount: 'table_field_subNamespaceCount',
	tableFieldCreator: 'table_field_creator',
	tableFieldStatus: 'table_field_status',
	tableFieldRegistrationHeight: 'table_field_registrationHeight',
	tableFieldExpirationHeight: 'table_field_expirationHeight',
	labelActive: 'label_active',
	labelExpired: 'label_expired',
	valueNeverExpired: 'value_neverExpired'
};

const activeChainHeight = namespace.expirationHeight - 1;
const expiredChainHeight = namespace.expirationHeight + 1;
const namespacePage = {
	data: namespaceList,
	pageNumber: 1
};

// Tests

describe('NamespaceList', () => {
	describe('getServerSideProps', () => {
		const requests = { namespacePage: [NamespaceService, 'fetchNamespacePage'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the namespaces props',
				config: {
					responses: { namespacePage }
				},
				expected: {
					requestArguments: { namespacePage: [] },
					result: {
						props: { namespaces: namespaceList }
					}
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<NamespaceList namespaces={config.namespaces} />);
		};

		describe('section: namespaces', () => {
			const namespacesCases = [
				{
					description: 'renders the table headers and the namespace rows',
					config: { namespaces: namespaceList },
					expected: {
						texts: [
							SCREEN_TEXT.sectionNamespaces,
							SCREEN_TEXT.tableFieldName,
							SCREEN_TEXT.tableFieldSubNamespaceCount,
							SCREEN_TEXT.tableFieldCreator,
							SCREEN_TEXT.tableFieldStatus,
							SCREEN_TEXT.tableFieldRegistrationHeight,
							SCREEN_TEXT.tableFieldExpirationHeight,
							...namespaceList.map(item => item.name),
							...namespaceList.map(item => item.creator)
						]
					}
				},
				{
					description: 'renders the sub-namespace count, registration and expiration heights',
					config: { namespaces: [namespace] },
					expected: {
						texts: [
							namespace.subNamespaceCount,
							namespace.registrationHeight,
							namespace.expirationHeight
						],
						hiddenTexts: [SCREEN_TEXT.valueNeverExpired]
					}
				},
				{
					description: 'renders the active status when the chain height is below the expiration height',
					config: {
						namespaces: [namespace],
						chainHeight: activeChainHeight
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 1,
							[SCREEN_TEXT.labelExpired]: 0
						}
					}
				},
				{
					description: 'renders the expired status when the chain height is above the expiration height',
					config: {
						namespaces: [namespace],
						chainHeight: expiredChainHeight
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 0,
							[SCREEN_TEXT.labelExpired]: 1
						}
					}
				},
				{
					description: 'renders the never expired value and the active status when the namespace has an unlimited duration',
					config: {
						namespaces: [nativeNamespace],
						chainHeight: expiredChainHeight
					},
					expected: {
						texts: [SCREEN_TEXT.valueNeverExpired],
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 1,
							[SCREEN_TEXT.labelExpired]: 0
						}
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: namespacesCases });
		});
	});
});
