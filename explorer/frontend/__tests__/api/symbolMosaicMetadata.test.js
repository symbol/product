import config from '@/config';
import * as utils from '@/utils/server';
import { fetchMosaicMetadataPage } from '@/variants/symbol/api/mosaicMetadata';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/mosaicMetadata', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('fetches and formats mosaic metadata entries', async () => {
		// Arrange:
		const response = {
			data: [
				{
					metadataEntry: {
						sourceAddress: '98C3D36895ED8AB0C2A26F5384D9CAD51F37094ED5FF0210',
						targetAddress: '9863A215A832D5755B14759BAC63EFD2C5F8416F73DF40F8',
						scopedMetadataKey: '0000676e69746172',
						targetId: '37E190650E56B5A7',
						metadataType: 1,
						value: '68656C6C6F'
					}
				},
				{
					metadataEntry: {
						sourceAddress: 'SOURCE_ADDRESS',
						targetAddress: 'TARGET_ADDRESS',
						scopedMetadataKey: '0000726174617661',
						targetId: '37E190650E56B5A7',
						metadataType: 1,
						value: '89504E47'
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchMosaicMetadataPage({
			targetId: '37E190650E56B5A7',
			pageNumber: 2
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/metadata?pageNumber=2&pageSize=10&order=desc&targetId=37E190650E56B5A7&metadataType=1';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					scopedMetadataKey: '0000676E69746172',
					targetId: '37E190650E56B5A7',
					metadataType: 'mosaic',
					senderAddress: 'TDB5G2EV5WFLBQVCN5JYJWOK2UPTOCKO2X7QEEA',
					targetAddress: 'TBR2EFNIGLKXKWYUOWN2YY7P2LC7QQLPOPPUB6A',
					value: 'hello'
				},
				{
					scopedMetadataKey: '0000726174617661',
					targetId: '37E190650E56B5A7',
					metadataType: 'mosaic',
					senderAddress: 'SOURCE_ADDRESS',
					targetAddress: 'TARGET_ADDRESS',
					value: '�PNG'
				}
			],
			pageNumber: 2
		});
	});
});
