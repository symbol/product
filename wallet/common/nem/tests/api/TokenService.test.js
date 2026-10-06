import { Api } from '../../src/api';
import { mosaicDefinitionDTO, ownedMosaicDTOs, subNamespaceMosaicDefinitionDTO } from '../__fixtures__/api/token-dtos';
import { networkProperties } from '../__fixtures__/local/network';
import { accountTokens, tokenInfos } from '../__fixtures__/local/token';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';
import { createMakeRequestMock, runApiServiceTest } from '../test-utils';
import { NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const ADDRESS = walletStorageAccounts.testnet[0].address;
const TOKEN_ID = 'test.token';
const SUB_NAMESPACE_TOKEN_ID = 'makoto.metals.silver';

// A mosaic definition page response groups its mosaics under a `mosaic` wrapper.
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
const testTokenDefinitionPage = { data: [{ mosaic: mosaicDefinitionDTO }] };
const silverDefinitionPage = { data: [{ mosaic: subNamespaceMosaicDefinitionDTO }] };

describe('api/TokenService', () => {
	describe('fetchTokenInfos', () => {
		const runFetchTokenInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.token.fetchTokenInfos(networkProperties, config.tokenIds),
					expected: expected.tokenInfos
				});
			});
		};

		const fetchTokenInfosTests = [
			{
				description: 'resolves token infos by querying the definition page per namespace',
				config: { tokenIds: [TOKEN_ID], requestMap: { [definitionPageUrl('test')]: testTokenDefinitionPage } },
				expected: { tokenInfos: { [TOKEN_ID]: tokenInfos[TOKEN_ID] } }
			},
			{
				description: 'resolves a sub-namespace token by querying its full dotted namespace',
				config: {
					tokenIds: [SUB_NAMESPACE_TOKEN_ID],
					requestMap: { [definitionPageUrl('makoto.metals')]: silverDefinitionPage }
				},
				expected: { tokenInfos: { [SUB_NAMESPACE_TOKEN_ID]: tokenInfos[SUB_NAMESPACE_TOKEN_ID] } }
			},
			{
				description: 'omits tokens whose definition page is not found',
				config: { tokenIds: [TOKEN_ID], requestMap: { [definitionPageUrl('test')]: new NotFoundError('Namespace not found') } },
				expected: { tokenInfos: {} }
			}
		];

		fetchTokenInfosTests.forEach(test => runFetchTokenInfosTest(test.description, test.config, test.expected));

		it('rethrows errors that are not a not-found', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [definitionPageUrl('test')]: new Error('Node unreachable') });
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.token.fetchTokenInfos(networkProperties, [TOKEN_ID])).rejects.toThrow('Node unreachable');
		});
	});

	describe('fetchTokenInfo', () => {
		it('resolves a single token info by id', async () => {
			// Arrange:
			const requestMap = { [definitionPageUrl('test')]: testTokenDefinitionPage };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.token.fetchTokenInfo(networkProperties, TOKEN_ID),
				expected: tokenInfos[TOKEN_ID]
			});
		});
	});

	describe('fetchAccountTokens', () => {
		it('resolves owned tokens against their definitions and seeds the native currency', async () => {
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
				call: api => api.token.fetchAccountTokens(networkProperties, ADDRESS),
				expected: accountTokens
			});
		});
	});
});
