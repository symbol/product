import { createSwapConfirmationText } from '@/app/screens/bridge/utils/swap-confirmation';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const AMOUNT = '1';
const TEXT_KEY = 's_bridge_swap_dialog_confirm_text';

// Token Fixtures

// Tokens listed in the known-tokens configuration
const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

// A token absent from the known-tokens configuration
const tokenUnlisted = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.build();

// Swap Side Fixtures

const createSwapSide = (token, chainName) => ({
	token,
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: {}
});

const sourceXym = createSwapSide(tokenXym, CHAIN_NAME_SYMBOL);
const sourceUnlisted = createSwapSide(tokenUnlisted, CHAIN_NAME_SYMBOL);
const targetBxym = createSwapSide(tokenBxym, CHAIN_NAME_ETHEREUM);

// Expected Text

// The localization mock echoes the key and its params, so the tickers are visible in the result
const createExpectedText = (sourceToken, targetToken) => `${TEXT_KEY}|${JSON.stringify({
	amount: AMOUNT,
	sourceToken,
	sourceChain: CHAIN_NAME_SYMBOL,
	targetToken,
	targetChain: CHAIN_NAME_ETHEREUM
})}`;

describe('screens/bridge/utils/swap-confirmation', () => {
	beforeEach(() => {
		mockLocalization((key, params) => `${key}|${JSON.stringify(params)}`);
	});

	describe('createSwapConfirmationText()', () => {
		const runCreateSwapConfirmationTextTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createSwapConfirmationText({
					source: config.source,
					target: config.target,
					amount: AMOUNT
				});

				// Assert:
				expect(result).toBe(expected.text);
			});
		};

		const createSwapConfirmationTextTests = [
			{
				description: 'names both tokens by their known ticker',
				config: { source: sourceXym, target: targetBxym },
				expected: { text: createExpectedText('XYM', 'bXYM') }
			},
			{
				description: 'names an unlisted token by its name',
				config: { source: sourceUnlisted, target: targetBxym },
				expected: { text: createExpectedText(tokenUnlisted.name, 'bXYM') }
			},
			{
				description: 'is empty while the source is not selected',
				config: { source: null, target: targetBxym },
				expected: { text: '' }
			},
			{
				description: 'is empty while the target is not selected',
				config: { source: sourceXym, target: null },
				expected: { text: '' }
			}
		];

		createSwapConfirmationTextTests.forEach(test =>
			runCreateSwapConfirmationTextTest(test.description, test.config, test.expected));
	});
});
