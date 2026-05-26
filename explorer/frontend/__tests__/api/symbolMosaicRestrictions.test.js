import config from '@/config';
import * as utils from '@/utils/server';
import {
	fetchMosaicRestrictionPage,
	MOSAIC_ADDRESS_RESTRICTION_TYPE,
	MOSAIC_GLOBAL_RESTRICTION_TYPE
} from '@/variants/symbol/api/mosaicRestrictions';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/mosaicRestrictions', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('fetches and formats mosaic global restrictions', async () => {
		// Arrange:
		const response = {
			data: [
				{
					mosaicRestrictionEntry: {
						compositeHash: 'E349F147BE1CEEC44DC63FF90552553DF5300FC71E91B33553660AF9B935ADE6',
						entryType: 1,
						mosaicId: '6F7904E6DF09D21D',
						restrictions: [
							{
								key: '790526',
								restriction: {
									referenceMosaicId: '0000000000000000',
									restrictionValue: '2',
									restrictionType: 6
								}
							}
						]
					}
				},
				{
					mosaicRestrictionEntry: {
						compositeHash: 'ADDRESS_RESTRICTION_SHOULD_BE_FILTERED',
						entryType: 0,
						mosaicId: '6F7904E6DF09D21D',
						restrictions: []
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchMosaicRestrictionPage({
			mosaicId: '6F7904E6DF09D21D',
			type: MOSAIC_GLOBAL_RESTRICTION_TYPE,
			pageNumber: 2,
			pageSize: 20
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(
			'/api/symbol-node/restrictions/mosaic?pageNumber=2&pageSize=20&order=desc&mosaicId=6F7904E6DF09D21D&type=1'
		);
		expect(result).toEqual({
			data: [
				{
					compositeHash: 'E349F147BE1CEEC44DC63FF90552553DF5300FC71E91B33553660AF9B935ADE6',
					entryType: 'Mosaic Global Restriction',
					targetAddress: null,
					restrictions: '6F7904E6DF09D21D Key 790526 Greater Than Or Equal 2'
				}
			],
			pageNumber: 2
		});
	});

	it('fetches and formats mosaic address restrictions', async () => {
		// Arrange:
		const response = {
			data: [
				{
					mosaicRestrictionEntry: {
						compositeHash: 'B50AFD8BE2EBE8DF7EFC67DCEEC50BE6F589FD6C3D6DBD558706633824B92968',
						entryType: 0,
						mosaicId: '6F7904E6DF09D21D',
						targetAddress: '980FE0526FA6F38999A3B4CF35A928A4391D4620634A025A',
						restrictions: [
							{
								key: '790526',
								value: '10'
							}
						]
					}
				},
				{
					mosaicRestrictionEntry: {
						compositeHash: 'GLOBAL_RESTRICTION_SHOULD_BE_FILTERED',
						entryType: 1,
						mosaicId: '6F7904E6DF09D21D',
						restrictions: []
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchMosaicRestrictionPage({
			mosaicId: '6F7904E6DF09D21D',
			type: MOSAIC_ADDRESS_RESTRICTION_TYPE
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(
			'/api/symbol-node/restrictions/mosaic?pageNumber=1&pageSize=10&order=desc&mosaicId=6F7904E6DF09D21D&type=0'
		);
		expect(result).toEqual({
			data: [
				{
					compositeHash: 'B50AFD8BE2EBE8DF7EFC67DCEEC50BE6F589FD6C3D6DBD558706633824B92968',
					entryType: 'Mosaic Address Restriction',
					targetAddress: 'TAH6AUTPU3ZYTGNDWTHTLKJIUQ4R2RRAMNFAEWQ',
					restrictions: '790526: 10'
				}
			],
			pageNumber: 1
		});
	});
});
