import { accountNamespaceDTO, namespaceInfoDTO } from '../__fixtures__/api/namespace-dtos';
import { namespace } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { runApiServiceTest } from '../test-utils';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const NAMESPACE_ID = namespace.id;
const OWNER_ADDRESS = namespace.owner;

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
			const requestMap = { [`${NODE_URL}/namespace?namespace=${NAMESPACE_ID}`]: namespaceInfoDTO };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.namespace.fetchNamespaceInfo(networkProperties, NAMESPACE_ID),
				expected: namespace
			});
		});
	});

	describe('fetchNamespaceInfos', () => {
		it('maps a list of namespace ids to a namespace map keyed by id', async () => {
			// Arrange:
			const requestMap = { [`${NODE_URL}/namespace?namespace=${NAMESPACE_ID}`]: namespaceInfoDTO };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.namespace.fetchNamespaceInfos(networkProperties, [NAMESPACE_ID]),
				expected: { [NAMESPACE_ID]: namespace }
			});
		});
	});
});
