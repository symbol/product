import { getTokenAmount, tokenIdFromRaw, tokenIdToRaw, tokenInfoFromDTO, tokenListFromDTO } from '../../src/utils';
import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/token-dtos';
import { accountTokens, tokenInfos } from '../__fixtures__/local/token';

// Constants

const MISSING_PARAMETERS_ERROR = 'Failed to get token amount. Missing required parameters.';
const MISSING_TOKEN_LIST_PARAMETERS_ERROR = 'Failed to format tokens. Missing required parameters.';

// Fixtures

// Token infos that resolve the owned mosaic DTOs: nem.xem is seeded from the network currency (it has no
// on-chain definition) and test.token reuses the shared resolved info. unknown.mosaic is intentionally absent.
const resolvedTokenInfos = {
	'nem.xem': { id: 'nem.xem', name: 'XEM', divisibility: 6 },
	'test.token': tokenInfos['test.token']
};

const tokenAmountList = [
	{ id: 'nem.xem', amount: '10.5' },
	{ id: 'test.token', amount: '2.5' }
];

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

		const tokenIdFromRawTests = [
			{
				description: 'joins a raw mosaic id object into a string id',
				config: { rawMosaicId: { namespaceId: 'nem', name: 'xem' } },
				expected: { tokenId: 'nem.xem' }
			},
			{
				description: 'returns an already-formatted string id unchanged',
				config: { rawMosaicId: 'nem.xem' },
				expected: { tokenId: 'nem.xem' }
			}
		];

		tokenIdFromRawTests.forEach(test => runTokenIdFromRawTest(test.description, test.config, test.expected));
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

		const tokenIdToRawTests = [
			{
				description: 'splits a root-namespace token id into a raw mosaic id object',
				config: { tokenId: 'nem.xem' },
				expected: { rawMosaicId: { namespaceId: 'nem', name: 'xem' } }
			},
			{
				description: 'keeps the dotted namespace of a sub-namespace token id',
				config: { tokenId: 'makoto.metals.silver' },
				expected: { rawMosaicId: { namespaceId: 'makoto.metals', name: 'silver' } }
			},
			{
				description: 'keeps the dotted namespace of a three-part sub-namespace token id',
				config: { tokenId: 'makoto.metals.silver.coin' },
				expected: { rawMosaicId: { namespaceId: 'makoto.metals.silver', name: 'coin' } }
			}
		];

		tokenIdToRawTests.forEach(test => runTokenIdToRawTest(test.description, test.config, test.expected));

		it('throws when the token id has no namespace separator', () => {
			// Act & Assert:
			expect(() => tokenIdToRaw('xem')).toThrow('Failed to parse token id. Invalid token id: xem.');
		});
	});

	describe('getTokenAmount', () => {
		const runGetTokenAmountTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getTokenAmount(tokenAmountList, config.tokenId);

				// Assert:
				expect(result).toBe(expected.amount);
			});
		};

		const getTokenAmountTests = [
			{
				description: 'returns the amount of the matching token',
				config: { tokenId: 'test.token' },
				expected: { amount: '2.5' }
			},
			{
				description: 'returns "0" when the token is absent from the list',
				config: { tokenId: 'absent.mosaic' },
				expected: { amount: '0' }
			}
		];

		getTokenAmountTests.forEach(test => runGetTokenAmountTest(test.description, test.config, test.expected));

		it('throws when the token list or token id is missing', () => {
			// Arrange:
			const missingParameterCases = [
				{ tokenList: null, tokenId: 'nem.xem' },
				{ tokenList: tokenAmountList, tokenId: null },
				{ tokenList: null, tokenId: null }
			];

			// Act & Assert:
			missingParameterCases.forEach(({ tokenList, tokenId }) =>
				expect(() => getTokenAmount(tokenList, tokenId)).toThrow(MISSING_PARAMETERS_ERROR));
		});
	});

	describe('tokenInfoFromDTO', () => {
		it('builds a token info from a mosaic definition DTO', () => {
			// Arrange:
			const expectedTokenInfo = tokenInfos['test.token'];

			// Act:
			const result = tokenInfoFromDTO(mosaicDefinitionDTO);

			// Assert:
			expect(result).toStrictEqual(expectedTokenInfo);
		});

		it('applies default property values when the definition omits them', () => {
			// Arrange: with no properties, divisibility and supply default to 0, the supply is immutable
			// and the token is transferable.
			const definitionDTO = { id: { namespaceId: 'foo', name: 'bar' }, properties: [] };
			const expectedTokenInfo = {
				id: 'foo.bar',
				name: 'foo.bar',
				divisibility: 0,
				supply: 0,
				isSupplyMutable: false,
				isTransferable: true
			};

			// Act:
			const result = tokenInfoFromDTO(definitionDTO);

			// Assert:
			expect(result).toStrictEqual(expectedTokenInfo);
		});
	});

	describe('tokenListFromDTO', () => {
		it('normalizes owned mosaic DTOs against the resolved token infos', () => {
			// Arrange: resolved tokens carry their relative amount and metadata; the unresolved token keeps
			// only its absolute amount with null relative amount and divisibility.
			const expectedTokenList = accountTokens;

			// Act:
			const result = tokenListFromDTO(ownedMosaicDTOs, resolvedTokenInfos);

			// Assert:
			expect(result).toStrictEqual(expectedTokenList);
		});

		it('returns an empty list when the mosaic DTOs are empty', () => {
			// Act:
			const result = tokenListFromDTO([], resolvedTokenInfos);

			// Assert:
			expect(result).toStrictEqual([]);
		});

		const runTokenListFromDTOErrorTest = (description, config) => {
			it(description, () => {
				// Act & Assert:
				expect(() => tokenListFromDTO(config.mosaicsDTO, config.tokenInfos)).toThrow(MISSING_TOKEN_LIST_PARAMETERS_ERROR);
			});
		};

		const tokenListFromDTOErrorTests = [
			{
				description: 'throws when the mosaic DTOs are missing',
				config: { mosaicsDTO: undefined, tokenInfos: resolvedTokenInfos }
			},
			{
				description: 'throws when the token infos are missing',
				config: { mosaicsDTO: ownedMosaicDTOs, tokenInfos: undefined }
			}
		];

		tokenListFromDTOErrorTests.forEach(test => runTokenListFromDTOErrorTest(test.description, test.config));
	});
});
