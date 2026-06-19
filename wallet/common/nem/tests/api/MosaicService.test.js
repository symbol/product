import { Api } from '../../src/api';
import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/mosaic-dtos';
import { accountMosaics, mosaicInfos } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';
import { createMakeRequestMock, runApiServiceTest } from '../test-utils';
import { NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const ADDRESS = walletStorageAccounts.testnet[0].address;
const MOSAIC_ID = 'test.token';

// A mosaic definition page response groups its mosaics under a `mosaic` wrapper.
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
const testTokenDefinitionPage = { data: [{ mosaic: mosaicDefinitionDTO }] };

describe('api/MosaicService', () => {
	describe('fetchMosaicInfos', () => {
		const runFetchMosaicInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.mosaic.fetchMosaicInfos(networkProperties, config.mosaicIds),
					expected: expected.mosaicInfos
				});
			});
		};

		const fetchMosaicInfosTests = [
			{
				description: 'resolves mosaic infos by querying the definition page per namespace',
				config: { mosaicIds: [MOSAIC_ID], requestMap: { [definitionPageUrl('test')]: testTokenDefinitionPage } },
				expected: { mosaicInfos: { [MOSAIC_ID]: mosaicInfos[MOSAIC_ID] } }
			},
			{
				description: 'omits mosaics whose definition page is not found',
				config: { mosaicIds: [MOSAIC_ID], requestMap: { [definitionPageUrl('test')]: new NotFoundError('Namespace not found') } },
				expected: { mosaicInfos: {} }
			}
		];

		fetchMosaicInfosTests.forEach(test => runFetchMosaicInfosTest(test.description, test.config, test.expected));

		it('rethrows errors that are not a not-found', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [definitionPageUrl('test')]: new Error('Node unreachable') });
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.mosaic.fetchMosaicInfos(networkProperties, [MOSAIC_ID])).rejects.toThrow('Node unreachable');
		});
	});

	describe('fetchMosaicInfo', () => {
		it('resolves a single mosaic info by id', async () => {
			// Arrange:
			const requestMap = { [definitionPageUrl('test')]: testTokenDefinitionPage };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.mosaic.fetchMosaicInfo(networkProperties, MOSAIC_ID),
				expected: mosaicInfos[MOSAIC_ID]
			});
		});
	});

	describe('fetchAccountMosaics', () => {
		it('resolves owned mosaics against their definitions and seeds the native currency', async () => {
			// Arrange: nem.xem has no on-chain definition (seeded from the network currency) and unknown.mosaic
			// has no definition at all, so their definition pages are empty.
			const requestMap = {
				[`${NODE_URL}/account/mosaic/owned?address=${ADDRESS}`]: { data: ownedMosaicDTOs },
				[definitionPageUrl('nem')]: { data: [] },
				[definitionPageUrl('test')]: testTokenDefinitionPage,
				[definitionPageUrl('unknown')]: { data: [] }
			};

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.mosaic.fetchAccountMosaics(networkProperties, ADDRESS),
				expected: accountMosaics
			});
		});
	});
});
