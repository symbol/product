import {
	formatMosaicList,
	getMosaicAmount,
	isMosaicRevokable,
	isMosaicSupplyModifiable,
	isRestrictableFlag,
	isRevokableFlag,
	isSupplyMutableFlag,
	isTransferableFlag,
	mosaicIdFromNonce,
	mosaicInfoFromDTO
} from '../../src/utils';
import { mosaicInfosResponse } from '../__fixtures__/api/mosaic-infos-response';
import {
	expiringSupplyImmutableMosaic,
	expiringSupplyMutableMosaic,
	mosaicCreatorAddress,
	mosaicHolderAddress,
	nativeMosaic,
	revokableMosaic
} from '../__fixtures__/local/mosaic';
import { generateBitCombinations } from '../test-utils';

const SUPPLY_MUTABLE_FLAG = 1;
const TRANSFERABLE_FLAG = 2;
const RESTRICTABLE_FLAG = 4;
const REVOKABLE_FLAG = 8;

// Below the end height of the expiring mosaics, so they are active unless a case overrides it
const CHAIN_HEIGHT = 1000;

const findMosaicInfoDTO = mosaicId => mosaicInfosResponse.find(mosaicInfoDTO => mosaicInfoDTO.mosaic.id === mosaicId).mosaic;

describe('utils/mosaic', () => {
	describe('getMosaicAmount', () => {
		const runGetMosaicAmountTest = (mosaicId, expectedAmount) => {
			// Act:
			const mosaicList = [
				{ id: 'mosaic1', amount: '100' },
				{ id: 'mosaic2', amount: '200' }
			];
			const result = getMosaicAmount(mosaicList, mosaicId);

			// Assert:
			expect(result).toBe(expectedAmount);
		};
		it('returns the mosaic amount by mosaic id', () => {
			// Arrange:
			const mosaicId = 'mosaic1';
			const expectedAmount = '100';

			// Act & Assert:
			runGetMosaicAmountTest(mosaicId, expectedAmount);
		});

		it('returns null if the mosaic is not found', () => {
			// Arrange:
			const mosaicId = 'mosaic3';
			const expectedAmount = '0';

			// Act & Assert:
			runGetMosaicAmountTest(mosaicId, expectedAmount);
		});

		const runGetMosaicAmountErrorTest = (mosaicList, mosaicId) => {
			// Arrange:
			const expectedErrorMessage = 'Failed to get mosaic amount. Missing required parameters.';

			// Act & Assert:
			expect(() => getMosaicAmount(mosaicList, mosaicId)).toThrow(expectedErrorMessage);
		};

		it('throws an error if the mosaic list is not provided', () => {
			// Arrange:
			const mosaicId = 'mosaic1';
			const mosaicList = null;

			// Act & Assert:
			runGetMosaicAmountErrorTest(mosaicList, mosaicId);
		});

		it('throws an error if the mosaic id is not provided', () => {
			// Arrange:
			const mosaicId = null;
			const mosaicList = [
				{ id: 'mosaic1', amount: '100' },
				{ id: 'mosaic2', amount: '200' }
			];

			// Act & Assert:
			runGetMosaicAmountErrorTest(mosaicList, mosaicId);
		});

		it('throws an error if the mosaic id and mosaic list are not provided', () => {
			// Arrange:
			const mosaicId = null;
			const mosaicList = null;

			// Act & Assert:
			runGetMosaicAmountErrorTest(mosaicList, mosaicId);
		});
	});

	describe('formatMosaicList', () => {
		it('returns the formatted mosaic list', () => {
			// Arrange:
			const rawMosaics = [
				{ id: 'mosaic1', amount: '100' },
				{ id: 'mosaic2', amount: '200' },
				{ id: 'mosaic3', amount: '300' }
			];
			const mosaicInfos = {
				mosaic1: { 
					id: 'mosaic1', 
					names: ['namespace1', 'another-namespace1'], 
					divisibility: 1 
				},
				mosaic2: { 
					id: 'mosaic2', 
					names: ['namespace2'], 
					divisibility: 3 
				}
			};
			const expectedMosaicList = [
				{ 
					id: 'mosaic1', 
					name: 'namespace1', 
					names: ['namespace1', 'another-namespace1'], 
					amount: '10', 
					divisibility: 1 
				},
				{ 
					id: 'mosaic2', 
					name: 'namespace2', 
					names: ['namespace2'],
					amount: '0.2', 
					divisibility: 3 
				},
				{ 
					id: 'mosaic3', 
					name: 'mosaic3', 
					amount: null, 
					absoluteAmount: '300' 
				}
			];

			// Act:
			const result = formatMosaicList(rawMosaics, mosaicInfos);

			// Assert:
			expect(result).toEqual(expectedMosaicList);
		});

		const runMosaicListFromRawErrorTest = (rawMosaics, mosaicInfos) => {
			// Arrange:
			const expectedErrorMessage = 'Failed to format mosaics. Missing required parameters.';

			// Act & Assert:
			expect(() => formatMosaicList(rawMosaics, mosaicInfos)).toThrow(expectedErrorMessage);
		};

		it('throws an error if the mosaic list is not provided', () => {
			// Arrange:
			const rawMosaics = null;
			const mosaicInfos = {
				mosaic1: { name: 'mosaic1', divisibility: 6 },
				mosaic2: { name: 'mosaic2', divisibility: 6 }
			};

			// Act & Assert:
			runMosaicListFromRawErrorTest(rawMosaics, mosaicInfos);
		});

		it('throws an error if the mosaic infos are not provided', () => {
			// Arrange:
			const rawMosaics = [
				{ id: 'mosaic1', amount: '100' },
				{ id: 'mosaic2', amount: '200' }
			];
			const mosaicInfos = null;

			// Act & Assert:
			runMosaicListFromRawErrorTest(rawMosaics, mosaicInfos);
		});
	});

	describe('isMosaicRevokable', () => {
		const runIsMosaicRevokableTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const currentAddress = config.currentAddress ?? mosaicCreatorAddress;
				const sourceAddress = config.sourceAddress ?? mosaicHolderAddress;

				// Act:
				const result = isMosaicRevokable(config.mosaic, CHAIN_HEIGHT, currentAddress, sourceAddress);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isMosaicRevokableTests = [
			{
				description: 'returns true if the mosaic is revokable, created by the current address and active',
				config: { mosaic: revokableMosaic },
				expected: { result: true }
			},
			{
				description: 'returns true if the mosaic has unlimited duration and the end height has passed',
				config: { mosaic: { ...revokableMosaic, endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: true } },
				expected: { result: true }
			},
			{
				description: 'returns true if the chain height is one block below the mosaic end height',
				config: { mosaic: { ...revokableMosaic, endHeight: CHAIN_HEIGHT + 1 } },
				expected: { result: true }
			},
			{
				description: 'returns false if the chain height reached the mosaic end height',
				config: { mosaic: { ...revokableMosaic, endHeight: CHAIN_HEIGHT } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is expired',
				config: { mosaic: { ...revokableMosaic, endHeight: CHAIN_HEIGHT - 1 } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is not revokable',
				config: { mosaic: expiringSupplyMutableMosaic },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic creator is not the current address',
				config: { mosaic: revokableMosaic, currentAddress: mosaicHolderAddress },
				expected: { result: false }
			},
			{
				description: 'returns false if the source address is the current address',
				config: { mosaic: revokableMosaic, sourceAddress: mosaicCreatorAddress },
				expected: { result: false }
			}
		];

		isMosaicRevokableTests.forEach(test => {
			runIsMosaicRevokableTest(test.description, test.config, test.expected);
		});
	});

	describe('isMosaicSupplyModifiable', () => {
		const runIsMosaicSupplyModifiableTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const currentAddress = config.currentAddress ?? mosaicCreatorAddress;

				// Act:
				const result = isMosaicSupplyModifiable(config.mosaic, CHAIN_HEIGHT, currentAddress);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isMosaicSupplyModifiableTests = [
			{
				description: 'returns true if the supply is mutable, the mosaic is created by the current address and active',
				config: { mosaic: expiringSupplyMutableMosaic },
				expected: { result: true }
			},
			{
				description: 'returns true if the mosaic has unlimited duration and the end height has passed',
				config: { mosaic: { ...expiringSupplyMutableMosaic, endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: true } },
				expected: { result: true }
			},
			{
				description: 'returns true if the chain height is one block below the mosaic end height',
				config: { mosaic: { ...expiringSupplyMutableMosaic, endHeight: CHAIN_HEIGHT + 1 } },
				expected: { result: true }
			},
			{
				description: 'returns false if the chain height reached the mosaic end height',
				config: { mosaic: { ...expiringSupplyMutableMosaic, endHeight: CHAIN_HEIGHT } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is expired',
				config: { mosaic: { ...expiringSupplyMutableMosaic, endHeight: CHAIN_HEIGHT - 1 } },
				expected: { result: false }
			},
			{
				description: 'returns false if the supply is not mutable',
				config: { mosaic: expiringSupplyImmutableMosaic },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic creator is not the current address',
				config: { mosaic: expiringSupplyMutableMosaic, currentAddress: mosaicHolderAddress },
				expected: { result: false }
			}
		];

		isMosaicSupplyModifiableTests.forEach(test => {
			runIsMosaicSupplyModifiableTest(test.description, test.config, test.expected);
		});
	});

	const runMosaicFlagsTest = (flags, expectedResult, flagFunction) => {
		flags.forEach(flag => {
			// Act:
			const result = flagFunction(flag);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	};

	describe('isSupplyMutableFlag', () => {
		it('returns true if the flag is supply mutable', () => {
			// Arrange:
			const flags = generateBitCombinations(SUPPLY_MUTABLE_FLAG, [TRANSFERABLE_FLAG, RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = true;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isSupplyMutableFlag);
		});

		it('returns false if the flag is not supply mutable', () => {
			// Arrange:
			const flags = generateBitCombinations(TRANSFERABLE_FLAG, [RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = false;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isSupplyMutableFlag);
		});
	});

	describe('isTransferableFlag', () => {
		it('returns true if the flag is transferable', () => {
			// Arrange:
			const flags = generateBitCombinations(TRANSFERABLE_FLAG, [SUPPLY_MUTABLE_FLAG, RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = true;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isTransferableFlag);
		});

		it('returns false if the flag is not transferable', () => {
			// Arrange:
			const flags = generateBitCombinations(RESTRICTABLE_FLAG, [SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = false;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isTransferableFlag);
		});
	});

	describe('isRestrictableFlag', () => {
		it('returns true if the flag is restrictable', () => {
			// Arrange:
			const flags = generateBitCombinations(RESTRICTABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = true;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isRestrictableFlag);
		});

		it('returns false if the flag is not restrictable', () => {
			// Arrange:
			const flags = generateBitCombinations(REVOKABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG]);
			const expectedResult = false;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isRestrictableFlag);
		});
	});

	describe('isRevokableFlag', () => {
		it('returns true if the flag is revokable', () => {
			// Arrange:
			const flags = generateBitCombinations(REVOKABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
			const expectedResult = true;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isRevokableFlag);
		});

		it('returns false if the flag is not revokable', () => {
			// Arrange:
			const flags = generateBitCombinations(RESTRICTABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG]);
			const expectedResult = false;

			// Act & Assert:
			runMosaicFlagsTest(flags, expectedResult, isRevokableFlag);
		});
	});

	describe('mosaicIdFromNonce', () => {
		const ownerAddress = 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ';
		const testCases = [
			{ description: 'derives the mosaic id from the owner address and nonce', nonce: 12345, expectedMosaicId: '619284EB8A8505DA' },
			{ description: 'derives the mosaic id for a zero nonce', nonce: 0, expectedMosaicId: '64CC999288ED1BB9' }
		];

		testCases.forEach(({ description, nonce, expectedMosaicId }) => it(description, () => {
			// Act:
			const result = mosaicIdFromNonce(ownerAddress, nonce);

			// Assert:
			expect(result).toBe(expectedMosaicId);
		}));
	});

	describe('mosaicInfoFromDTO', () => {
		it('formats a mosaic node DTO into mosaic info with empty names', () => {
			// Arrange:
			const mosaicDTO = findMosaicInfoDTO(nativeMosaic.id);
			const expectedResult = {
				...nativeMosaic,
				names: []
			};

			// Act:
			const result = mosaicInfoFromDTO(mosaicDTO);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
