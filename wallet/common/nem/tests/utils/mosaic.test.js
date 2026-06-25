import { getMosaicAmount, mosaicIdFromRaw, mosaicIdToRaw, mosaicInfoFromDTO, mosaicListFromDTO } from '../../src/utils';
import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/mosaic-dtos';
import { accountMosaics, mosaicInfos } from '../__fixtures__/local/mosaic';

// Constants

const MISSING_PARAMETERS_ERROR = 'Failed to get mosaic amount. Missing required parameters.';

// Fixtures

// Mosaic infos that resolve the owned mosaic DTOs: nem.xem is seeded from the network currency (it has no
// on-chain definition) and test.token reuses the shared resolved info. unknown.mosaic is intentionally absent.
const resolvedMosaicInfos = {
	'nem.xem': { id: 'nem.xem', name: 'XEM', divisibility: 6 },
	'test.token': mosaicInfos['test.token']
};

const mosaicAmountList = [
	{ id: 'nem.xem', amount: '10.5' },
	{ id: 'test.token', amount: '2.5' }
];

describe('utils/mosaic', () => {
	describe('mosaicIdFromRaw', () => {
		const runMosaicIdFromRawTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = mosaicIdFromRaw(config.rawMosaicId);

				// Assert:
				expect(result).toBe(expected.mosaicId);
			});
		};

		const mosaicIdFromRawTests = [
			{
				description: 'joins a raw mosaic id object into a string id',
				config: { rawMosaicId: { namespaceId: 'nem', name: 'xem' } },
				expected: { mosaicId: 'nem.xem' }
			},
			{
				description: 'returns an already-formatted string id unchanged',
				config: { rawMosaicId: 'nem.xem' },
				expected: { mosaicId: 'nem.xem' }
			}
		];

		mosaicIdFromRawTests.forEach(test => runMosaicIdFromRawTest(test.description, test.config, test.expected));
	});

	describe('mosaicIdToRaw', () => {
		const runMosaicIdToRawTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = mosaicIdToRaw(config.mosaicId);

				// Assert:
				expect(result).toStrictEqual(expected.rawMosaicId);
			});
		};

		const mosaicIdToRawTests = [
			{
				description: 'splits a root-namespace mosaic id into a raw mosaic id object',
				config: { mosaicId: 'nem.xem' },
				expected: { rawMosaicId: { namespaceId: 'nem', name: 'xem' } }
			},
			{
				description: 'keeps the dotted namespace of a sub-namespace mosaic id',
				config: { mosaicId: 'makoto.metals.silver' },
				expected: { rawMosaicId: { namespaceId: 'makoto.metals', name: 'silver' } }
			},
			{
				description: 'keeps the dotted namespace of a three-part sub-namespace mosaic id',
				config: { mosaicId: 'makoto.metals.silver.coin' },
				expected: { rawMosaicId: { namespaceId: 'makoto.metals.silver', name: 'coin' } }
			}
		];

		mosaicIdToRawTests.forEach(test => runMosaicIdToRawTest(test.description, test.config, test.expected));

		it('throws when the mosaic id has no namespace separator', () => {
			// Act & Assert:
			expect(() => mosaicIdToRaw('xem')).toThrow('Failed to parse mosaic id. Invalid mosaic id: xem.');
		});
	});

	describe('getMosaicAmount', () => {
		const runGetMosaicAmountTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getMosaicAmount(mosaicAmountList, config.mosaicId);

				// Assert:
				expect(result).toBe(expected.amount);
			});
		};

		const getMosaicAmountTests = [
			{
				description: 'returns the amount of the matching mosaic',
				config: { mosaicId: 'test.token' },
				expected: { amount: '2.5' }
			},
			{
				description: 'returns "0" when the mosaic is absent from the list',
				config: { mosaicId: 'absent.mosaic' },
				expected: { amount: '0' }
			}
		];

		getMosaicAmountTests.forEach(test => runGetMosaicAmountTest(test.description, test.config, test.expected));

		it('throws when the mosaic list or mosaic id is missing', () => {
			// Arrange:
			const missingParameterCases = [
				{ mosaicList: null, mosaicId: 'nem.xem' },
				{ mosaicList: mosaicAmountList, mosaicId: null },
				{ mosaicList: null, mosaicId: null }
			];

			// Act & Assert:
			missingParameterCases.forEach(({ mosaicList, mosaicId }) =>
				expect(() => getMosaicAmount(mosaicList, mosaicId)).toThrow(MISSING_PARAMETERS_ERROR));
		});
	});

	describe('mosaicInfoFromDTO', () => {
		it('builds a mosaic info from a mosaic definition DTO', () => {
			// Arrange:
			const expectedMosaicInfo = mosaicInfos['test.token'];

			// Act:
			const result = mosaicInfoFromDTO(mosaicDefinitionDTO);

			// Assert:
			expect(result).toStrictEqual(expectedMosaicInfo);
		});

		it('applies default property values when the definition omits them', () => {
			// Arrange: with no properties, divisibility and supply default to 0, the supply is immutable
			// and the mosaic is transferable.
			const definitionDTO = { id: { namespaceId: 'foo', name: 'bar' }, properties: [] };
			const expectedMosaicInfo = {
				id: 'foo.bar',
				name: 'foo.bar',
				divisibility: 0,
				supply: 0,
				isSupplyMutable: false,
				isTransferable: true
			};

			// Act:
			const result = mosaicInfoFromDTO(definitionDTO);

			// Assert:
			expect(result).toStrictEqual(expectedMosaicInfo);
		});
	});

	describe('mosaicListFromDTO', () => {
		it('normalizes owned mosaic DTOs against the resolved mosaic infos', () => {
			// Arrange: resolved mosaics carry their relative amount and metadata; the unresolved mosaic keeps
			// only its absolute amount with null relative amount and divisibility.
			const expectedMosaicList = accountMosaics;

			// Act:
			const result = mosaicListFromDTO(ownedMosaicDTOs, resolvedMosaicInfos);

			// Assert:
			expect(result).toStrictEqual(expectedMosaicList);
		});

		const runEmptyMosaicListTest = (description, config) => {
			it(description, () => {
				// Act:
				const result = mosaicListFromDTO(config.mosaicsDTO, resolvedMosaicInfos);

				// Assert:
				expect(result).toStrictEqual([]);
			});
		};

		const emptyMosaicListTests = [
			{ description: 'returns an empty list when the mosaic DTOs are undefined', config: { mosaicsDTO: undefined } },
			{ description: 'returns an empty list when the mosaic DTOs are empty', config: { mosaicsDTO: [] } }
		];

		emptyMosaicListTests.forEach(test => runEmptyMosaicListTest(test.description, test.config));
	});
});
