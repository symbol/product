import config from '@/config';
import * as utils from '@/utils/server';
import { fetchMosaicArtifactExpiryReceiptPage, fetchMosaicReceiptPage } from '@/variants/symbol/api/mosaicReceipts';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/mosaicReceipts', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('fetches mosaic rental fee receipts for mosaic registration height and formats rows', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3407435',
						receipts: [
							{
								version: 1,
								type: 4685,
								recipientAddress: '9876338F1CC0C9C135808AF05CFE92A69CB023902CB88CFA',
								mosaicId: '72C0212E67A08BCE',
								amount: '172800000'
							},
							{
								version: 1,
								type: 4942,
								recipientAddress: 'FILTERED_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '1'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchMosaicReceiptPage({
			height: 3407435,
			pageNumber: 2
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(
			'/api/symbol-node/statements/transaction?pageNumber=2&pageSize=10&order=desc&height=3407435&receiptType=4685'
		);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					type: 'mosaicRentalFee',
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

	it('fetches mosaic expired receipts for mosaic expiration height and formats rows', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3396665',
						receipts: [
							{
								version: 1,
								type: 8515,
								targetAddress: '98699CA34F65FCD521743819EACD2DC2709994E85245DB40',
								mosaicId: '72C0212E67A08BCE',
								amount: '76026550'
							},
							{
								version: 1,
								type: 16717,
								artifactId: '54521A62D14B4558'
							},
							{
								version: 1,
								type: 20803,
								mosaicId: '72C0212E67A08BCE',
								amount: '108609356'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchMosaicArtifactExpiryReceiptPage({
			height: 3396665,
			pageNumber: 2
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(
			'/api/symbol-node/statements/transaction?pageNumber=2&pageSize=10&order=desc&height=3396665&receiptType=16717'
		);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					type: 'mosaicExpired',
					artifactId: '54521A62D14B4558'
				}
			],
			pageNumber: 2
		});
	});
});
