import {
	buildCreatedTokenListSections,
	filterCreatedTokens,
	getCreatedTokenListFilterConfig,
	mergeHeldAmounts
} from '@/app/screens/mosaic/utils';
import { FilterType } from '@/app/types/Filter';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CHAIN_HEIGHT = 150_000;

// Screen Text

const SCREEN_TEXT = {
	textFilterRevokable: 's_createdTokenList_filter_revokable',
	textFilterSupplyMutable: 's_createdTokenList_filter_supplyMutable',
	textFilterExpired: 's_createdTokenList_filter_expired'
};

// Token Fixtures

const activeTokenDefaults = { endHeight: 0, isUnlimitedDuration: true };

const revokableToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.override({ ...activeTokenDefaults, isRevokable: true, isSupplyMutable: false })
	.build();

const supplyMutableToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.override({ ...activeTokenDefaults, isRevokable: false, isSupplyMutable: true })
	.build();

const revokableSupplyMutableToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.override({ ...activeTokenDefaults, isRevokable: true, isSupplyMutable: true })
	.build();

const expiredRevokableToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.override({
		endHeight: CHAIN_HEIGHT - 1000,
		isUnlimitedDuration: false,
		isRevokable: true,
		isSupplyMutable: false
	})
	.build();

const allTokens = [revokableToken, supplyMutableToken, revokableSupplyMutableToken, expiredRevokableToken];
const activeTokens = [revokableToken, supplyMutableToken, revokableSupplyMutableToken];

describe('screens/mosaic/utils/created-token-list', () => {
	describe('getCreatedTokenListFilterConfig()', () => {
		it('returns boolean filter items for the revokable and supply mutable flags', () => {
			// Arrange:
			mockLocalization();
			const expectedConfig = [
				{
					name: 'revokable',
					title: SCREEN_TEXT.textFilterRevokable,
					type: FilterType.BOOLEAN
				},
				{
					name: 'supplyMutable',
					title: SCREEN_TEXT.textFilterSupplyMutable,
					type: FilterType.BOOLEAN
				},
				{
					name: 'expired',
					title: SCREEN_TEXT.textFilterExpired,
					type: FilterType.BOOLEAN
				}
			];

			// Act:
			const config = getCreatedTokenListFilterConfig();

			// Assert:
			expect(config).toEqual(expectedConfig);
		});
	});

	describe('filterCreatedTokens()', () => {
		const runFilterCreatedTokensTest = (description, filter, expectedTokens) => {
			it(description, () => {
				// Act:
				const result = filterCreatedTokens(allTokens, filter, CHAIN_HEIGHT);

				// Assert:
				expect(result).toEqual(expectedTokens);
			});
		};

		runFilterCreatedTokensTest(
			'returns active tokens and hides expired ones when no filter is active',
			{},
			activeTokens
		);
		runFilterCreatedTokensTest(
			'returns all tokens including expired ones when the expired filter is active',
			{ expired: true },
			allTokens
		);
		runFilterCreatedTokensTest(
			'returns only active revokable tokens when the revokable filter is active',
			{ revokable: true },
			[revokableToken, revokableSupplyMutableToken]
		);
		runFilterCreatedTokensTest(
			'returns only active supply mutable tokens when the supply mutable filter is active',
			{ supplyMutable: true },
			[supplyMutableToken, revokableSupplyMutableToken]
		);
		runFilterCreatedTokensTest(
			'returns active tokens matching both flags when both flag filters are active',
			{ revokable: true, supplyMutable: true },
			[revokableSupplyMutableToken]
		);
		runFilterCreatedTokensTest(
			'returns expired tokens matching a flag when the flag and expired filters are active',
			{ revokable: true, expired: true },
			[revokableToken, revokableSupplyMutableToken, expiredRevokableToken]
		);
	});

	describe('mergeHeldAmounts()', () => {
		it('merges held amounts and names into the token definitions', () => {
			// Arrange:
			const heldTokenDefinition = TokenFixtureBuilder
				.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
				.override({ names: ['held.token'] })
				.build();
			const unheldTokenDefinition = TokenFixtureBuilder
				.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
				.override({ names: ['unheld.token'] })
				.build();
			const heldToken = TokenFixtureBuilder
				.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
				.override({ amount: '150' })
				.build();
			const expectedTokens = [
				{
					...heldTokenDefinition,
					amount: '150',
					name: heldToken.name
				},
				{
					...unheldTokenDefinition,
					amount: '0',
					name: 'unheld.token'
				}
			];

			// Act:
			const result = mergeHeldAmounts([heldTokenDefinition, unheldTokenDefinition], [heldToken]);

			// Assert:
			expect(result).toEqual(expectedTokens);
		});

		it('falls back to the token id as the name when the definition has no names', () => {
			// Arrange:
			const unnamedTokenDefinition = TokenFixtureBuilder
				.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
				.override({ names: [] })
				.build();
			const expectedTokens = [
				{
					...unnamedTokenDefinition,
					amount: '0',
					name: unnamedTokenDefinition.id
				}
			];

			// Act:
			const result = mergeHeldAmounts([unnamedTokenDefinition], []);

			// Assert:
			expect(result).toEqual(expectedTokens);
		});
	});

	describe('buildCreatedTokenListSections()', () => {
		it('wraps the tokens into a single untitled section', () => {
			// Arrange:
			const expectedSections = [
				{
					title: '',
					group: 'createdTokens',
					data: allTokens
				}
			];

			// Act:
			const result = buildCreatedTokenListSections(allTokens);

			// Assert:
			expect(result).toEqual(expectedSections);
		});

		it('returns no sections when the token list is empty', () => {
			// Act:
			const result = buildCreatedTokenListSections([]);

			// Assert:
			expect(result).toEqual([]);
		});
	});
});
