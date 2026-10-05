import {
	getTokenAmount,
	isMosaicRevokable,
	isMosaicSupplyModifiable,
	isRestrictableFlag,
	isRevokableFlag,
	isSupplyMutableFlag,
	isTransferableFlag,
	mosaicIdFromNonce,
	tokenInfoFromDTO,
	tokenListFromDTO
} from '../../src/utils';
import { tokenInfosResponse } from '../__fixtures__/api/token-infos-response';
import {
	expiringSupplyImmutableToken,
	expiringSupplyMutableToken,
	nativeToken,
	revokableToken,
	tokenCreatorAddress,
	tokenHolderAddress
} from '../__fixtures__/local/token';
import { generateBitCombinations } from '../test-utils';

const SUPPLY_MUTABLE_FLAG = 1;
const TRANSFERABLE_FLAG = 2;
const RESTRICTABLE_FLAG = 4;
const REVOKABLE_FLAG = 8;

// Below the end height of the expiring mosaics, so they are active unless a case overrides it
const CHAIN_HEIGHT = 1000;

const findMosaicInfoDTO = mosaicId => tokenInfosResponse.find(mosaicInfoDTO => mosaicInfoDTO.mosaic.id === mosaicId).mosaic;

describe('utils/token', () => {
	describe('getTokenAmount', () => {
		const runGetTokenAmountTest = (tokenId, expectedAmount) => {
			// Act:
			const tokenList = [
				{ id: 'token1', amount: '100' },
				{ id: 'token2', amount: '200' }
			];
			const result = getTokenAmount(tokenList, tokenId);

			// Assert:
			expect(result).toBe(expectedAmount);
		};
		it('returns the token amount by token id', () => {
			// Arrange:
			const tokenId = 'token1';
			const expectedAmount = '100';

			// Act & Assert:
			runGetTokenAmountTest(tokenId, expectedAmount);
		});

		it('returns null if the token is not found', () => {
			// Arrange:
			const tokenId = 'token3';
			const expectedAmount = '0';

			// Act & Assert:
			runGetTokenAmountTest(tokenId, expectedAmount);
		});

		const runGetTokenAmountErrorTest = (tokenList, tokenId) => {
			// Arrange:
			const expectedErrorMessage = 'Failed to get token amount. Missing required parameters.';

			// Act & Assert:
			expect(() => getTokenAmount(tokenList, tokenId)).toThrow(expectedErrorMessage);
		};

		it('throws an error if the token list is not provided', () => {
			// Arrange:
			const tokenId = 'token1';
			const tokenList = null;

			// Act & Assert:
			runGetTokenAmountErrorTest(tokenList, tokenId);
		});

		it('throws an error if the token id is not provided', () => {
			// Arrange:
			const tokenId = null;
			const tokenList = [
				{ id: 'token1', amount: '100' },
				{ id: 'token2', amount: '200' }
			];

			// Act & Assert:
			runGetTokenAmountErrorTest(tokenList, tokenId);
		});

		it('throws an error if the token id and token list are not provided', () => {
			// Arrange:
			const tokenId = null;
			const tokenList = null;

			// Act & Assert:
			runGetTokenAmountErrorTest(tokenList, tokenId);
		});
	});

	describe('tokenListFromDTO', () => {
		it('returns the formatted token list', () => {
			// Arrange:
			const rawMosaics = [
				{ id: 'token1', amount: '100' },
				{ id: 'token2', amount: '200' },
				{ id: 'token3', amount: '300' }
			];
			const tokenInfos = {
				token1: {
					id: 'token1',
					name: 'namespace1',
					names: ['namespace1', 'another-namespace1'],
					divisibility: 1
				},
				token2: {
					id: 'token2',
					name: null,
					names: [],
					divisibility: 3
				}
			};
			const expectedTokenList = [
				{
					id: 'token1',
					name: 'namespace1',
					names: ['namespace1', 'another-namespace1'],
					amount: '10',
					divisibility: 1
				},
				{
					id: 'token2',
					name: null,
					names: [],
					amount: '0.2',
					divisibility: 3
				},
				{
					id: 'token3',
					amount: null,
					absoluteAmount: '300'
				}
			];

			// Act:
			const result = tokenListFromDTO(rawMosaics, tokenInfos);

			// Assert:
			expect(result).toEqual(expectedTokenList);
		});

		const runTokenListFromDTOErrorTest = (rawMosaics, tokenInfos) => {
			// Arrange:
			const expectedErrorMessage = 'Failed to format tokens. Missing required parameters.';

			// Act & Assert:
			expect(() => tokenListFromDTO(rawMosaics, tokenInfos)).toThrow(expectedErrorMessage);
		};

		it('throws an error if the mosaic list is not provided', () => {
			// Arrange:
			const rawMosaics = null;
			const tokenInfos = {
				token1: { name: 'token1', divisibility: 6 },
				token2: { name: 'token2', divisibility: 6 }
			};

			// Act & Assert:
			runTokenListFromDTOErrorTest(rawMosaics, tokenInfos);
		});

		it('throws an error if the token infos are not provided', () => {
			// Arrange:
			const rawMosaics = [
				{ id: 'token1', amount: '100' },
				{ id: 'token2', amount: '200' }
			];
			const tokenInfos = null;

			// Act & Assert:
			runTokenListFromDTOErrorTest(rawMosaics, tokenInfos);
		});
	});

	describe('isMosaicRevokable', () => {
		const runIsMosaicRevokableTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const currentAddress = config.currentAddress ?? tokenCreatorAddress;
				const sourceAddress = config.sourceAddress ?? tokenHolderAddress;

				// Act:
				const result = isMosaicRevokable(config.token, CHAIN_HEIGHT, currentAddress, sourceAddress);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isMosaicRevokableTests = [
			{
				description: 'returns true if the mosaic is revokable, created by the current address and active',
				config: { token: revokableToken },
				expected: { result: true }
			},
			{
				description: 'returns true if the mosaic has unlimited duration and the end height has passed',
				config: { token: { ...revokableToken, endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: true } },
				expected: { result: true }
			},
			{
				description: 'returns true if the chain height is one block below the mosaic end height',
				config: { token: { ...revokableToken, endHeight: CHAIN_HEIGHT + 1 } },
				expected: { result: true }
			},
			{
				description: 'returns false if the chain height reached the mosaic end height',
				config: { token: { ...revokableToken, endHeight: CHAIN_HEIGHT } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is expired',
				config: { token: { ...revokableToken, endHeight: CHAIN_HEIGHT - 1 } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is not revokable',
				config: { token: expiringSupplyMutableToken },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic creator is not the current address',
				config: { token: revokableToken, currentAddress: tokenHolderAddress },
				expected: { result: false }
			},
			{
				description: 'returns false if the source address is the current address',
				config: { token: revokableToken, sourceAddress: tokenCreatorAddress },
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
				const currentAddress = config.currentAddress ?? tokenCreatorAddress;

				// Act:
				const result = isMosaicSupplyModifiable(config.token, CHAIN_HEIGHT, currentAddress);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isMosaicSupplyModifiableTests = [
			{
				description: 'returns true if the supply is mutable, the mosaic is created by the current address and active',
				config: { token: expiringSupplyMutableToken },
				expected: { result: true }
			},
			{
				description: 'returns true if the mosaic has unlimited duration and the end height has passed',
				config: { token: { ...expiringSupplyMutableToken, endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: true } },
				expected: { result: true }
			},
			{
				description: 'returns true if the chain height is one block below the mosaic end height',
				config: { token: { ...expiringSupplyMutableToken, endHeight: CHAIN_HEIGHT + 1 } },
				expected: { result: true }
			},
			{
				description: 'returns false if the chain height reached the mosaic end height',
				config: { token: { ...expiringSupplyMutableToken, endHeight: CHAIN_HEIGHT } },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic is expired',
				config: { token: { ...expiringSupplyMutableToken, endHeight: CHAIN_HEIGHT - 1 } },
				expected: { result: false }
			},
			{
				description: 'returns false if the supply is not mutable',
				config: { token: expiringSupplyImmutableToken },
				expected: { result: false }
			},
			{
				description: 'returns false if the mosaic creator is not the current address',
				config: { token: expiringSupplyMutableToken, currentAddress: tokenHolderAddress },
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

	describe('tokenInfoFromDTO', () => {
		it('formats a mosaic node DTO into token info with empty names', () => {
			// Arrange:
			const mosaicDTO = findMosaicInfoDTO(nativeToken.id);
			const expectedResult = {
				...nativeToken,
				name: null,
				names: []
			};

			// Act:
			const result = tokenInfoFromDTO(mosaicDTO);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
