import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/mosaic-dtos';
import { accountMosaics, mosaicInfos } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';
import { runApiServiceTest } from '../test-utils';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const ADDRESS = walletStorageAccounts.testnet[0].address;
const MOSAIC_ID = 'test.token';

// A mosaic definition page response groups its mosaics under a `mosaic` wrapper.
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
const testTokenDefinitionPage = { data: [{ mosaic: mosaicDefinitionDTO }] };

describe('api/MosaicService', () => {
	describe('fetchMosaicInfos', () => {
		it('resolves mosaic infos by querying the definition page per namespace', async () => {
			// Arrange:
			const requestMap = { [definitionPageUrl('test')]: testTokenDefinitionPage };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.mosaic.fetchMosaicInfos(networkProperties, [MOSAIC_ID]),
				expected: { [MOSAIC_ID]: mosaicInfos[MOSAIC_ID] }
			});
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
