import config from '@/config';
import * as utils from '@/utils/server';
import { fetchNamespaceInfo, fetchNamespacePage } from '@/variants/symbol/api/namespaces';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/namespaces', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	describe('fetchNamespacePage', () => {
		it('fetches readable namespace names for namespace ids', async () => {
			// Arrange:
			const response = {
				data: [
					{
						namespace: {
							registrationType: 0,
							depth: 1,
							level0: 'D47D7DC85A201C13',
							ownerAddress: 'OWNER_ADDRESS',
							startHeight: '100',
							endHeight: '200'
						}
					},
					{
						namespace: {
							registrationType: 1,
							depth: 2,
							level0: 'D47D7DC85A201C13',
							level1: 'DA664716F7672DD7',
							ownerAddress: 'OWNER_ADDRESS_2',
							startHeight: '120',
							endHeight: '220'
						}
					}
				]
			};
			const namespaceNamesResponse = [
				{
					id: 'D47D7DC85A201C13',
					name: 'pppplllll'
				},
				{
					id: 'DA664716F7672DD7',
					name: 'pppplllll.subnamespace'
				}
			];
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(namespaceNamesResponse);
			const expectedNamespaceNameRequest = {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds: ['D47D7DC85A201C13', 'DA664716F7672DD7']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			};

			// Act:
			const result = await fetchNamespacePage({
				pageNumber: 2,
				pageSize: 50
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(
				1,
				'/api/symbol-node/namespaces?pageNumber=2&pageSize=50&order=desc'
			);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/namespaces/names', expectedNamespaceNameRequest);
			expect(result).toEqual({
				data: [
					{
						name: 'D47D7DC85A201C13',
						id: 'D47D7DC85A201C13',
						namespaceName: 'pppplllll',
						creator: 'OWNER_ADDRESS',
						registrationHeight: 100,
						expirationHeight: 200,
						isUnlimitedDuration: false,
						subNamespaceCount: 0,
						subNamespaces: [],
						namespaceMosaics: []
					},
					{
						name: 'DA664716F7672DD7',
						id: 'DA664716F7672DD7',
						namespaceName: 'pppplllll.subnamespace',
						creator: 'OWNER_ADDRESS_2',
						registrationHeight: 120,
						expirationHeight: 220,
						isUnlimitedDuration: false,
						subNamespaceCount: null,
						subNamespaces: [],
						namespaceMosaics: []
					}
				],
				pageNumber: 2
			});
		});

		it('keeps namespace page available when readable namespace name lookup fails with 409', async () => {
			// Arrange:
			const response = {
				data: [
					{
						namespace: {
							registrationType: 0,
							depth: 1,
							level0: 'D47D7DC85A201C13',
							ownerAddress: 'OWNER_ADDRESS',
							startHeight: '100',
							endHeight: '200'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockRejectedValueOnce({
				response: {
					status: 409
				}
			});

			// Act:
			const result = await fetchNamespacePage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
			expect(result.data[0]).toEqual({
				name: 'D47D7DC85A201C13',
				id: 'D47D7DC85A201C13',
				namespaceName: null,
				creator: 'OWNER_ADDRESS',
				registrationHeight: 100,
				expirationHeight: 200,
				isUnlimitedDuration: false,
				subNamespaceCount: 0,
				subNamespaces: [],
				namespaceMosaics: []
			});
		});

		it('prepends parent namespace names when child namespace name response contains only the child part', async () => {
			// Arrange:
			const response = {
				data: [
					{
						namespace: {
							registrationType: 1,
							depth: 2,
							level0: 'E3C847ED08A752F9',
							level1: 'E1DF939840839027',
							ownerAddress: 'OWNER_ADDRESS',
							startHeight: '100',
							endHeight: '200'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce([
				{
					id: 'E3C847ED08A752F9',
					name: 'parent'
				},
				{
					id: 'E1DF939840839027',
					name: 'child',
					parentId: 'E3C847ED08A752F9'
				}
			]);

			// Act:
			const result = await fetchNamespacePage();

			// Assert:
			expect(result.data[0].namespaceName).toBe('parent.child');
		});

		it('fetches namespaces filtered by address alias', async () => {
			// Arrange:
			const response = { data: [] };
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			await fetchNamespacePage({
				isAddressAlias: true,
				pageNumber: 3
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/namespaces?pageNumber=3&pageSize=10&order=desc&aliasType=2');
		});

		it('fetches namespaces filtered by mosaic alias', async () => {
			// Arrange:
			const response = { data: [] };
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			await fetchNamespacePage({
				isMosaicAlias: true
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/namespaces?pageNumber=1&pageSize=10&order=desc&aliasType=1');
		});

		it('fetches root and sub namespaces with registration type filters', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValue({ data: [] });

			// Act:
			await fetchNamespacePage({ isRoot: true });
			await fetchNamespacePage({ isSub: true });

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(
				1,
				'/api/symbol-node/namespaces?pageNumber=1&pageSize=10&order=desc&registrationType=0'
			);
			expect(makeRequest).toHaveBeenNthCalledWith(
				2,
				'/api/symbol-node/namespaces?pageNumber=1&pageSize=10&order=desc&registrationType=1'
			);
		});

		it('always fetches namespace page in descending order', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValue({ data: [] });

			// Act:
			await fetchNamespacePage({
				isRoot: true,
				order: 'asc'
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/namespaces?pageNumber=1&pageSize=10&order=desc&registrationType=0');
		});
	});

	describe('fetchNamespaceInfo', () => {
		it('fetches readable namespace name for a namespace id', async () => {
			// Arrange:
			const response = {
				namespace: {
					registrationType: 0,
					depth: 1,
					level0: 'D47D7DC85A201C13',
					ownerAddress: 'OWNER_ADDRESS',
					startHeight: '100',
					endHeight: '200'
				}
			};
			const namespaceNamesResponse = [
				{
					id: 'D47D7DC85A201C13',
					name: 'pppplllll'
				}
			];
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(namespaceNamesResponse);

			// Act:
			const result = await fetchNamespaceInfo('D47D7DC85A201C13');

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/namespaces/D47D7DC85A201C13');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/namespaces/names', {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds: ['D47D7DC85A201C13']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.namespaceName).toBe('pppplllll');
		});

		it('fetches namespace info by resolving a namespace name to its namespace id', async () => {
			// Arrange:
			const response = {
				namespace: {
					registrationType: 1,
					depth: 2,
					level0: 'C440B80BCE158950',
					level1: 'CC5FD5CF9AB1A84A',
					ownerAddress: '983FF5A219FBACA421FD33D8B7C2BF6A75F961A0FD90B356',
					startHeight: '6357',
					endHeight: '5194037'
				}
			};
			const namespaceNamesResponse = [
				{
					id: 'C440B80BCE158950',
					name: 'pasomi'
				},
				{
					id: 'CC5FD5CF9AB1A84A',
					name: 'pasomi.sn'
				}
			];
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(namespaceNamesResponse);

			// Act:
			const result = await fetchNamespaceInfo('pasomi.sn');

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/namespaces/CC5FD5CF9AB1A84A');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/namespaces/names', {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds: ['C440B80BCE158950', 'CC5FD5CF9AB1A84A']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.id).toBe('CC5FD5CF9AB1A84A');
			expect(result.namespaceName).toBe('pasomi.sn');
		});
	});
});
