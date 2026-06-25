import { Api } from '../../src/api';
import { accountNamespaceDTO, namespaceInfoDTO } from '../__fixtures__/api/namespace-dtos';
import { namespace } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { createMakeRequestMock, runApiServiceTest } from '../test-utils';
import { NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const NAMESPACE_ID = namespace.id;
const UNKNOWN_NAMESPACE_ID = 'unknown';
const OWNER_ADDRESS = namespace.owner;

const namespaceUrl = namespaceId => `${NODE_URL}/namespace?namespace=${namespaceId}`;

describe('api/NamespaceService', () => {
	describe('fetchAccountNamespaces', () => {
		it('maps the namespaces owned by an account', async () => {
			// Arrange:
			const requestMap = {
				[`${NODE_URL}/account/namespace/page?address=${OWNER_ADDRESS}`]: { data: [accountNamespaceDTO] }
			};

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.namespace.fetchAccountNamespaces(networkProperties, OWNER_ADDRESS),
				expected: [namespace]
			});
		});
	});

	describe('fetchNamespaceInfo', () => {
		it('maps a single namespace fetched by id', async () => {
			// Arrange:
			const requestMap = { [namespaceUrl(NAMESPACE_ID)]: namespaceInfoDTO };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.namespace.fetchNamespaceInfo(networkProperties, NAMESPACE_ID),
				expected: namespace
			});
		});
	});

	describe('fetchNamespaceInfos', () => {
		const runFetchNamespaceInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.namespace.fetchNamespaceInfos(networkProperties, config.namespaceIds),
					expected: expected.namespaceInfos
				});
			});
		};

		const fetchNamespaceInfosTests = [
			{
				description: 'maps a list of namespace ids to a namespace map keyed by id',
				config: { namespaceIds: [NAMESPACE_ID], requestMap: { [namespaceUrl(NAMESPACE_ID)]: namespaceInfoDTO } },
				expected: { namespaceInfos: { [NAMESPACE_ID]: namespace } }
			},
			{
				description: 'omits namespaces that are not found and keeps the resolved ones',
				config: {
					namespaceIds: [NAMESPACE_ID, UNKNOWN_NAMESPACE_ID],
					requestMap: {
						[namespaceUrl(NAMESPACE_ID)]: namespaceInfoDTO,
						[namespaceUrl(UNKNOWN_NAMESPACE_ID)]: new NotFoundError('Namespace not found')
					}
				},
				expected: { namespaceInfos: { [NAMESPACE_ID]: namespace } }
			}
		];

		fetchNamespaceInfosTests.forEach(test => runFetchNamespaceInfosTest(test.description, test.config, test.expected));

		it('rethrows errors that are not a not-found', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [namespaceUrl(NAMESPACE_ID)]: new Error('Node unreachable') });
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.namespace.fetchNamespaceInfos(networkProperties, [NAMESPACE_ID])).rejects.toThrow('Node unreachable');
		});
	});
});
