import { getTokenAmount, tokenIdFromRaw, tokenIdToRaw, tokenInfoFromDTO, tokenListFromDTO } from '../../src/utils';
import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/token-dtos';
import { networkProperties } from '../__fixtures__/local/network';
import { accountTokens, tokenInfos } from '../__fixtures__/local/token';

const { networkCurrency } = networkProperties;
const tokenInfosWithNative = { ...tokenInfos, [networkCurrency.id]: networkCurrency };
const tokenList = [
	{ id: 'nem.xem', amount: '10.5' },
	{ id: 'test.token', amount: '2.5' }
];
const nativeMosaicId = { namespaceId: 'nem', name: 'xem' };
const testMosaicId = { namespaceId: 'test', name: 'token' };

describe('utils/token', () => {
	describe('tokenIdFromRaw', () => {
		const runTokenIdFromRawTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = tokenIdFromRaw(config.rawMosaicId);

				// Assert:
				expect(result).toBe(expected.tokenId);
			});
		};

		const tests = [
			{
				description: 'joins a raw mosaic id object into a token id',
				config: {
					rawMosaicId: { namespaceId: 'nem', name: 'xem' }
				},
				expected: { tokenId: 'nem.xem' }
			},
			{
				description: 'returns a token id string unchanged',
				config: { rawMosaicId: 'nem.xem' },
				expected: { tokenId: 'nem.xem' }
			}
		];

		tests.forEach(test => {
			runTokenIdFromRawTest(test.description, test.config, test.expected);
		});
	});

	describe('tokenIdToRaw', () => {
		const runTokenIdToRawTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = tokenIdToRaw(config.tokenId);

				// Assert:
				expect(result).toStrictEqual(expected.rawMosaicId);
			});
		};

		const tests = [
			{
				description: 'splits a token id into a raw mosaic id object',
				config: { tokenId: 'nem.xem' },
				expected: {
					rawMosaicId: { namespaceId: 'nem', name: 'xem' }
				}
			},
			{
				description: 'keeps the dotted namespace of a sub-namespace token id',
				config: { tokenId: 'makoto.metals.silver' },
				expected: {
					rawMosaicId: { namespaceId: 'makoto.metals', name: 'silver' }
				}
			}
		];

		tests.forEach(test => {
			runTokenIdToRawTest(test.description, test.config, test.expected);
		});

		it('throws when the token id has no namespace separator', () => {
			// Arrange:
			const expectedErrorMessage = 'Failed to parse token id. Invalid token id: xem.';

			// Act & Assert:
			expect(() => tokenIdToRaw('xem')).toThrow(expectedErrorMessage);
		});
	});

	describe('getTokenAmount', () => {
		const runGetTokenAmountTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getTokenAmount(tokenList, config.tokenId);

				// Assert:
				expect(result).toBe(expected.amount);
			});
		};

		const tests = [
			{
				description: 'returns the amount of the listed token',
				config: { tokenId: 'test.token' },
				expected: { amount: '2.5' }
			},
			{
				description: 'returns "0" when the token is not in the list',
				config: { tokenId: 'absent.mosaic' },
				expected: { amount: '0' }
			}
		];

		tests.forEach(test => {
			runGetTokenAmountTest(test.description, test.config, test.expected);
		});

		const runGetTokenAmountErrorTest = (description, config) => {
			it(description, () => {
				// Arrange:
				const expectedErrorMessage = 'Failed to get token amount. Missing required parameters.';

				// Act & Assert:
				expect(() => getTokenAmount(config.tokenList, config.tokenId)).toThrow(expectedErrorMessage);
			});
		};

		const errorTests = [
			{
				description: 'throws when the token list is missing',
				config: { tokenList: null, tokenId: 'nem.xem' }
			},
			{
				description: 'throws when the token id is missing',
				config: { tokenList, tokenId: null }
			}
		];

		errorTests.forEach(test => {
			runGetTokenAmountErrorTest(test.description, test.config);
		});
	});

	describe('tokenInfoFromDTO', () => {
		const runTokenInfoFromDTOTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = tokenInfoFromDTO(config.mosaicDefinitionDTO);

				// Assert:
				expect(result).toStrictEqual(expected.tokenInfo);
			});
		};

		const tests = [
			{
				description: 'builds a token info from a mosaic definition DTO',
				config: { mosaicDefinitionDTO },
				expected: { tokenInfo: tokenInfos['test.token'] }
			},
			{
				description: 'uses default values when the definition has no properties',
				config: {
					mosaicDefinitionDTO: {
						id: { namespaceId: 'foo', name: 'bar' },
						properties: []
					}
				},
				expected: {
					tokenInfo: {
						id: 'foo.bar',
						name: 'foo.bar',
						divisibility: 0,
						supply: 0,
						isSupplyMutable: false,
						isTransferable: true
					}
				}
			}
		];

		tests.forEach(test => {
			runTokenInfoFromDTOTest(test.description, test.config, test.expected);
		});
	});

	describe('tokenListFromDTO', () => {
		const runTokenListFromDTOTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = tokenListFromDTO(config.mosaicsDTO, tokenInfosWithNative, config.transferAmount);

				// Assert:
				expect(result).toStrictEqual(expected.tokenList);
			});
		};

		const tests = [
			{
				description: 'converts mosaic DTOs to tokens',
				config: { mosaicsDTO: ownedMosaicDTOs },
				expected: { tokenList: accountTokens }
			},
			{
				description: 'returns an empty list when there are no mosaic DTOs',
				config: { mosaicsDTO: [] },
				expected: { tokenList: [] }
			},
			{
				description: 'multiplies every amount by the amount multiplier',
				config: {
					mosaicsDTO: [
						{ mosaicId: testMosaicId, quantity: 2 },
						{ mosaicId: nativeMosaicId, quantity: 250000 }
					],
					transferAmount: 3000000
				},
				expected: {
					tokenList: [
						{ ...tokenInfos['test.token'], amount: '0.06' },
						{ ...networkCurrency, amount: '0.75' }
					]
				}
			},
			{
				description: 'drops the fraction left by a fractional amount multiplier',
				config: {
					mosaicsDTO: [
						{ mosaicId: nativeMosaicId, quantity: 1000001 }
					],
					transferAmount: 1500000
				},
				expected: {
					tokenList: [
						{ ...networkCurrency, amount: '1.500001' }
					]
				}
			},
			{
				description: 'keeps a multiplied amount above the safe integer range exact',
				config: {
					mosaicsDTO: [
						{ mosaicId: testMosaicId, quantity: 8999999999999999 }
					],
					transferAmount: 3000000
				},
				expected: {
					tokenList: [
						{ ...tokenInfos['test.token'], amount: '269999999999999.97' }
					]
				}
			},
			{
				description: 'multiplies the absolute amount of an unresolved mosaic',
				config: {
					mosaicsDTO: [
						{
							mosaicId: { namespaceId: 'unknown', name: 'mosaic' },
							quantity: 5
						}
					],
					transferAmount: 2000000
				},
				expected: {
					tokenList: [
						{
							id: 'unknown.mosaic',
							name: 'unknown.mosaic',
							amount: null,
							absoluteAmount: '10'
						}
					]
				}
			}
		];

		tests.forEach(test => {
			runTokenListFromDTOTest(test.description, test.config, test.expected);
		});

		const runTokenListFromDTOErrorTest = (description, config) => {
			it(description, () => {
				// Arrange:
				const expectedErrorMessage = 'Failed to format tokens. Missing required parameters.';

				// Act & Assert:
				expect(() => tokenListFromDTO(config.mosaicsDTO, config.tokenInfos)).toThrow(expectedErrorMessage);
			});
		};

		const errorTests = [
			{
				description: 'throws when the mosaic DTOs are missing',
				config: { mosaicsDTO: undefined, tokenInfos: tokenInfosWithNative }
			},
			{
				description: 'throws when the token infos are missing',
				config: { mosaicsDTO: ownedMosaicDTOs, tokenInfos: undefined }
			}
		];

		errorTests.forEach(test => {
			runTokenListFromDTOErrorTest(test.description, test.config);
		});
	});
});
