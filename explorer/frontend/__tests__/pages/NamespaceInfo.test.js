import '@testing-library/jest-dom';
import { namespace, namespaceWithMosaics, nativeNamespace } from '../../__fixtures__/local/namespace';
import { setDevice } from '../test-utils/device';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as BlockService from '@/app/api/blocks';
import * as NamespaceService from '@/app/api/namespaces';
import NamespaceInfo, { getServerSideProps } from '@/app/pages/namespaces/[id]';
import { act, render, screen, waitFor } from '@testing-library/react';

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
const namespaceWithDisplaySupply = {
	...namespaceWithMosaics,
	namespaceMosaics: [
		{
			...namespaceWithMosaics.namespaceMosaics[0],
			data: [{ ...namespaceWithMosaics.namespaceMosaics[0].data[0], displaySupply: 1500 }]
		},
		{
			...namespaceWithMosaics.namespaceMosaics[1],
			data: [{ ...namespaceWithMosaics.namespaceMosaics[1].data[0], displaySupply: 10000 }]
		}
	]
};
const namespaceMosaic = namespaceWithDisplaySupply.namespaceMosaics[0].data[0];

const createDisplayNamespaceInfo = mosaics => ({
	id: 'A95F1F8A96159516',
	name: 'root',
	creator: 'creator-account-address',
	subNamespaces: ['root.child'],
	registrationTimestamp: '2020-01-02 03:04:05',
	registrationHeight: 1,
	expirationHeight: 10000,
	isUnlimitedDuration: false,
	namespaceMosaics: [
		{
			namespaceId: 'A95F1F8A96159516',
			namespaceName: 'root',
			data: mosaics
		}
	]
});

const createDisplayMosaic = ({
	id = '85BBEA6CC462B244',
	registrationTimestamp = '2024-06-15 12:34:56',
	namespaceExpirationHeight = 100,
	isUnlimitedDuration = false,
	...mosaicFields
} = {}) => ({
	id,
	name: id,
	creator: 'creator-account-address',
	registrationHeight: 2,
	registrationTimestamp,
	namespaceExpirationHeight,
	isUnlimitedDuration,
	...mosaicFields
});

const mobileExpirationCases = [
	{ description: 'before expiration', chainHeight: 99, isUnlimitedDuration: false, expectedStatus: 'label_active' },
	{ description: 'at expiration', chainHeight: 100, isUnlimitedDuration: false, expectedStatus: 'label_expired' },
	{ description: 'after expiration', chainHeight: 101, isUnlimitedDuration: false, expectedStatus: 'label_expired' },
	{
		description: 'with unlimited duration after the expiration height',
		chainHeight: 101,
		isUnlimitedDuration: true,
		expectedStatus: 'label_active'
	}
];

const mosaicSupplyCases = [
	{
		description: 'Symbol value while REST supply is in absolute units',
		mosaicId: '72C0212E67A08BCE',
		mosaicFields: {
			supply: 8388098149704674,
			value: 8388098149.704674,
			displaySupply: 8388098149.704674
		},
		expectedText: '8388098149.704674'
	},
	{
		description: 'NEM totalSupply in Mosaic units',
		mosaicId: 'nem.xem',
		mosaicFields: { supply: 8999999999 },
		expectedText: '8999999999'
	},
	{
		description: 'an explicitly undefined displaySupply without falling back to supply',
		mosaicId: 'undefined-display-supply',
		mosaicFields: { supply: 5000, displaySupply: undefined },
		expectedText: ''
	},
	{
		description: 'a zero displaySupply without falling back to supply',
		mosaicId: 'zero-display-supply',
		mosaicFields: { supply: 5000, displaySupply: 0 },
		expectedText: '0'
	}
];

const timestampDisplayCases = [
	{
		device: 'desktop',
		description: 'null timestamp',
		mosaicId: 'desktop-null-timestamp',
		registrationTimestamp: null,
		expectedText: '-'
	},
	{
		device: 'desktop',
		description: 'undefined timestamp',
		mosaicId: 'desktop-undefined-timestamp',
		registrationTimestamp: undefined,
		expectedText: '-'
	},
	{
		device: 'desktop',
		description: 'numeric zero timestamp',
		mosaicId: 'desktop-zero-timestamp',
		registrationTimestamp: 0,
		expectedText: 'month_jan 1, 1970 • 00:00'
	},
	{
		device: 'desktop',
		description: 'normal timestamp string',
		mosaicId: 'desktop-valid-timestamp',
		registrationTimestamp: '2024-06-15 12:34:56',
		expectedText: 'month_jun 15, 2024 • 12:34'
	},
	{ device: 'mobile', description: 'null timestamp', mosaicId: 'mobile-null-timestamp', registrationTimestamp: null, expectedText: '-' },
	{
		device: 'mobile',
		description: 'undefined timestamp',
		mosaicId: 'mobile-undefined-timestamp',
		registrationTimestamp: undefined,
		expectedText: '-'
	},
	{
		device: 'mobile',
		description: 'numeric zero timestamp',
		mosaicId: 'mobile-zero-timestamp',
		registrationTimestamp: 0,
		expectedText: 'month_jan 1, 1970'
	},
	{
		device: 'mobile',
		description: 'normal timestamp string',
		mosaicId: 'mobile-valid-timestamp',
		registrationTimestamp: '2024-06-15 12:34:56',
		expectedText: 'month_jun 15, 2024'
	}
];

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
					config: { namespaceInfo: namespaceWithDisplaySupply },
					expected: {
						texts: [
							SCREEN_TEXT.sectionMosaics,
							SCREEN_TEXT.tableFieldName,
							SCREEN_TEXT.tableFieldSupply,
							SCREEN_TEXT.tableFieldRegistrationHeight,
							namespaceMosaic.name,
							namespaceMosaic.displaySupply,
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

		describe('Mosaic supply display', () => {
			it.each(mosaicSupplyCases)('renders the $description in its Mosaic Supply cell', async ({
				mosaicId,
				mosaicFields,
				expectedText
			}) => {
				// Arrange:
				setDevice('desktop');
				const mosaic = createDisplayMosaic({ id: mosaicId, ...mosaicFields });
				const namespaceInfo = createDisplayNamespaceInfo([mosaic]);

				// Act:
				render(<NamespaceInfo namespaceInfo={namespaceInfo} />);
				await act(async () => {});

				// Assert:
				const mosaicLink = screen.getByRole('link', { name: new RegExp(mosaicId) });
				const mosaicRow = mosaicLink.closest('.dataRow');
				const supplyCell = mosaicRow?.children[1];
				expect(supplyCell).not.toBeNull();
				expect(supplyCell.textContent).toBe(expectedText);
			});
		});

		describe('Mosaic mobile expiration status', () => {
			it.each(mobileExpirationCases)('uses the fetched chain height for $description', async ({
				chainHeight,
				isUnlimitedDuration,
				expectedStatus
			}) => {
				// Arrange:
				setDevice('mobile');
				let resolveChainHeight;
				const chainHeightResponse = new Promise(resolve => {
					resolveChainHeight = resolve;
				});
				BlockService.fetchChainHight.mockReturnValue(chainHeightResponse);
				const namespaceInfo = createDisplayNamespaceInfo([createDisplayMosaic({ isUnlimitedDuration })]);

				// Act:
				render(<NamespaceInfo namespaceInfo={namespaceInfo} />);

				// Assert the initial state while the chain-height request is still pending.
				expect(screen.getByText('label_active')).toBeInTheDocument();

				// Act: resolve the page's asynchronous chain-height request.
				await act(async () => {
					resolveChainHeight(chainHeight);
				});

				// Assert:
				await waitFor(() => expect(screen.getByText(expectedStatus)).toBeInTheDocument());
				expect(screen.queryByText(expectedStatus === 'label_active' ? 'label_expired' : 'label_active'))
					.not.toBeInTheDocument();
			});
		});

		describe('Mosaic registration timestamps', () => {
			it.each(timestampDisplayCases)('$device displays the $description in the Mosaic timestamp cell', async ({
				device,
				mosaicId,
				registrationTimestamp,
				expectedText
			}) => {
				// Arrange:
				setDevice(device);
				const mosaic = {
					...createDisplayMosaic({ id: mosaicId }),
					registrationTimestamp
				};
				const namespaceInfo = createDisplayNamespaceInfo([mosaic]);

				// Act:
				render(<NamespaceInfo namespaceInfo={namespaceInfo} />);
				await act(async () => {});

				// Assert:
				const mosaicLink = screen.getByRole('link', { name: new RegExp(mosaicId) });
				const timestampCell = device === 'desktop'
					? mosaicLink.closest('.dataRow')?.children[3]
					: mosaicLink.querySelector('.timestamp');
				expect(timestampCell).not.toBeNull();
				expect(timestampCell.textContent).toBe(expectedText);
			});
		});
	});
});
