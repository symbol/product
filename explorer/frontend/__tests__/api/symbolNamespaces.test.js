import config from '@/config';
import * as utils from '@/utils/server';
import {
	fetchNamespaceInfo,
	fetchNamespaceMetadataPage,
	fetchNamespacePage,
	fetchNamespaceReceiptPage
} from '@/variants/symbol/api/namespaces';

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
						namespaceLevels: [
							{
								name: 'pppplllll',
								namespaceId: 'D47D7DC85A201C13',
								parentId: null
							}
						],
						aliasType: 'none',
						aliasMosaicId: null,
						aliasAddress: null,
						creator: 'OWNER_ADDRESS',
						registrationHeight: 100,
						registrationType: 'root',
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
						namespaceLevels: [
							{
								name: 'subnamespace',
								namespaceId: 'DA664716F7672DD7',
								parentId: 'D47D7DC85A201C13'
							},
							{
								name: 'pppplllll',
								namespaceId: 'D47D7DC85A201C13',
								parentId: null
							}
						],
						aliasType: 'none',
						aliasMosaicId: null,
						aliasAddress: null,
						creator: 'OWNER_ADDRESS_2',
						registrationHeight: 120,
						registrationType: 'sub',
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
				namespaceLevels: [
					{
						name: null,
						namespaceId: 'D47D7DC85A201C13',
						parentId: null
					}
				],
				aliasType: 'none',
				aliasMosaicId: null,
				aliasAddress: null,
				creator: 'OWNER_ADDRESS',
				registrationHeight: 100,
				registrationType: 'root',
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
			expect(result.aliasType).toBe('none');
			expect(result.aliasMosaicId).toBe(null);
			expect(result.aliasAddress).toBe(null);
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

		it('maps namespace level rows from deepest level to root', async () => {
			// Arrange:
			const response = {
				namespace: {
					registrationType: 1,
					depth: 3,
					level0: 'C308F07908B26A58',
					level1: 'DAF0482B1DA42F1E',
					level2: 'B3F9BD70918F71E7',
					ownerAddress: 'OWNER_ADDRESS',
					startHeight: '3386221',
					endHeight: '3475501'
				}
			};
			const namespaceNamesResponse = [
				{
					id: 'C308F07908B26A58',
					name: 'tes1'
				},
				{
					id: 'DAF0482B1DA42F1E',
					name: 'tes1.sub1'
				},
				{
					id: 'B3F9BD70918F71E7',
					name: 'tes1.sub1.sub2'
				}
			];
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(namespaceNamesResponse);

			// Act:
			const result = await fetchNamespaceInfo('B3F9BD70918F71E7');

			// Assert:
			expect(result.namespaceLevels).toEqual([
				{
					name: 'sub2',
					namespaceId: 'B3F9BD70918F71E7',
					parentId: 'DAF0482B1DA42F1E'
				},
				{
					name: 'sub1',
					namespaceId: 'DAF0482B1DA42F1E',
					parentId: 'C308F07908B26A58'
				},
				{
					name: 'tes1',
					namespaceId: 'C308F07908B26A58',
					parentId: null
				}
			]);
		});

		it('maps mosaic alias info', async () => {
			// Arrange:
			const response = {
				namespace: {
					registrationType: 1,
					depth: 2,
					level0: 'C308F07908B26A58',
					level1: 'DAF0482B1DA42F1E',
					alias: {
						type: 1,
						mosaicId: '343B5E93242F8C10'
					},
					ownerAddress: 'OWNER_ADDRESS',
					startHeight: '3386221',
					endHeight: '3475501'
				}
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce([]);

			// Act:
			const result = await fetchNamespaceInfo('DAF0482B1DA42F1E');

			// Assert:
			expect(result.aliasType).toBe('mosaic');
			expect(result.aliasMosaicId).toBe('343B5E93242F8C10');
			expect(result.aliasAddress).toBe(null);
		});

		it('maps address alias info', async () => {
			// Arrange:
			const response = {
				namespace: {
					registrationType: 0,
					depth: 1,
					level0: 'CD4D35E1B462AC00',
					alias: {
						type: 2,
						address: 'ALIAS_ADDRESS'
					},
					ownerAddress: 'OWNER_ADDRESS',
					startHeight: '3366590',
					endHeight: '3455870'
				}
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce([]);

			// Act:
			const result = await fetchNamespaceInfo('CD4D35E1B462AC00');

			// Assert:
			expect(result.aliasType).toBe('address');
			expect(result.aliasMosaicId).toBe(null);
			expect(result.aliasAddress).toBe('ALIAS_ADDRESS');
		});
	});

	describe('fetchNamespaceMetadataPage', () => {
		it('fetches namespace metadata and formats entries', async () => {
			// Arrange:
			const response = {
				data: [
					{
						metadataEntry: {
							sourceAddress: '9876338F1CC0C9C135808AF05CFE92A69CB023902CB88CFA',
							targetAddress: '9876338F1CC0C9C135808AF05CFE92A69CB023902CB88CFA',
							scopedMetadataKey: 'bb3026e7612a769f',
							targetId: 'FDB25189E8A1A5CE',
							metadataType: 2,
							value: '5468697320697320612073616D706C65206D6F73616963'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await fetchNamespaceMetadataPage({
				targetId: 'FDB25189E8A1A5CE',
				pageNumber: 2
			});

			// Assert:
			const expectedUrl = '/api/symbol-node/metadata?pageNumber=2&pageSize=10&order=desc&targetId=FDB25189E8A1A5CE&metadataType=2';
			expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
			expect(result).toEqual({
				data: [
					{
						scopedMetadataKey: 'BB3026E7612A769F',
						targetId: 'FDB25189E8A1A5CE',
						metadataType: 'namespace',
						senderAddress: 'TB3DHDY4YDE4CNMARLYFZ7USU2OLAI4QFS4IZ6Q',
						targetAddress: 'TB3DHDY4YDE4CNMARLYFZ7USU2OLAI4QFS4IZ6Q',
						value: 'This is a sample mosaic'
					}
				],
				pageNumber: 2
			});
		});

		it('decodes metadata value as text without interpreting HTML', async () => {
			// Arrange:
			const response = {
				data: [
					{
						metadataEntry: {
							sourceAddress: 'SOURCE_ADDRESS',
							targetAddress: 'TARGET_ADDRESS',
							scopedMetadataKey: 'BB3026E7612A769F',
							value: '3C696D67207372633D78206F6E6572726F723D616C6572742831293E'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await fetchNamespaceMetadataPage({
				targetId: 'FDB25189E8A1A5CE'
			});

			// Assert:
			expect(result.data[0].value).toBe('<img src=x onerror=alert(1)>');
		});
	});

	describe('fetchNamespaceReceiptPage', () => {
		it('fetches namespace rental fee receipts and formats rows', async () => {
			// Arrange:
			config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
			config.NATIVE_MOSAIC_DIVISIBILITY = 6;
			const response = {
				data: [
					{
						statement: {
							height: '3407435',
							receipts: [
								{
									version: 1,
									type: 4942,
									recipientAddress: '9876338F1CC0C9C135808AF05CFE92A69CB023902CB88CFA',
									mosaicId: '72C0212E67A08BCE',
									amount: '172800000'
								}
							]
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await fetchNamespaceReceiptPage({
				height: 3407435,
				pageNumber: 2
			});

			// Assert:
			const expectedUrl = '/api/symbol-node/statements/transaction?pageNumber=2&pageSize=10&order=desc'
				+ '&height=3407435&receiptType=4942';
			expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
			expect(result).toEqual({
				data: [
					{
						version: 1,
						type: 'namespaceRentalFee',
						to: 'TB3DHDY4YDE4CNMARLYFZ7USU2OLAI4QFS4IZ6Q',
						mosaic: {
							id: '72C0212E67A08BCE',
							name: '72C0212E67A08BCE',
							amount: 172.8,
							isNative: true
						}
					}
				],
				pageNumber: 2
			});
		});

		it('filters receipts by namespace rental fee type', async () => {
			// Arrange:
			const response = {
				data: [
					{
						statement: {
							receipts: [
								{
									version: 1,
									type: 1234,
									recipientAddress: 'RECIPIENT_ADDRESS',
									mosaicId: '72C0212E67A08BCE',
									amount: '1'
								},
								{
									version: 1,
									type: 4942,
									recipientAddress: 'RECIPIENT_ADDRESS',
									mosaicId: 'CUSTOM_MOSAIC',
									amount: '25'
								}
							]
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await fetchNamespaceReceiptPage({
				height: 3407435
			});

			// Assert:
			expect(result.data).toEqual([
				{
					version: 1,
					type: 'namespaceRentalFee',
					to: 'RECIPIENT_ADDRESS',
					mosaic: {
						id: 'CUSTOM_MOSAIC',
						name: 'CUSTOM_MOSAIC',
						amount: '25',
						isNative: false
					}
				}
			]);
		});
	});
});
