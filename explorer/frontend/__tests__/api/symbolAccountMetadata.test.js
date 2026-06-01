import config from '@/config';
import * as utils from '@/utils/server';
import { fetchAccountMetadataPage } from '@/variants/symbol/api/accountMetadata';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/accountMetadata', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('fetches latest metadata entries for an account target address', async () => {
		// Arrange:
		const response = {
			data: [
				{
					metadataEntry: {
						sourceAddress: 'SOURCE_ADDRESS',
						targetAddress: 'TARGET_ADDRESS',
						scopedMetadataKey: 'bb3026e7612a769f',
						metadataType: 0,
						value: '48656C6C6F'
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchAccountMetadataPage({
			targetAddress: 'TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			pageNumber: 2,
			isLatest: true
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/metadata?pageNumber=2&pageSize=10&order=desc'
			+ '&targetAddress=TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					scopedMetadataKey: 'BB3026E7612A769F',
					targetId: null,
					metadataType: 'account',
					senderAddress: 'SOURCE_ADDRESS',
					targetAddress: 'TARGET_ADDRESS',
					value: 'Hello'
				}
			],
			pageNumber: 2
		});
	});

	it.each([
		['isAccount', 0],
		['isMosaic', 1],
		['isNamespace', 2]
	])('maps %s filter to metadata type', async (filterName, metadataType) => {
		// Arrange:
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce({ data: [] });

		// Act:
		await fetchAccountMetadataPage({
			targetAddress: 'TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			[filterName]: true
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/metadata?pageNumber=1&pageSize=10&order=desc'
			+ `&targetAddress=TCJFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY&metadataType=${metadataType}`;
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
	});
});
