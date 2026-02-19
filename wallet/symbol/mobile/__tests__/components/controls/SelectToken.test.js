import { SelectToken } from '@/app/components/controls/SelectToken';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { runDropdownSelectTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';

// Mocks

jest.mock('@/app/utils', () => ({
	getTokenKnownInfo: (chainName, networkIdentifier, tokenId) => {
		const tokenInfoMap = {
			'6BED913FA20223F8': { name: 'Symbol Token', ticker: 'XYM', imageId: 'symbol' },
			'3A8416DB2D53B6C8': { name: 'Custom Token', ticker: 'CTK', imageId: 'custom' },
			'4A8416DB2D53B6C8': { name: null, ticker: null, imageId: null }
		};
		return tokenInfoMap[tokenId] || {};
	}
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'mainnet';

// Screen Text

const SCREEN_TEXT = {
	inputSelectTokenLabel: 'select_token',
	textSymbolTokenName: 'Symbol Token',
	textCustomTokenName: 'Custom Token',
	textUnknownTokenName: 'Mainnet Symbol Token 2',
	textSymbolTokenDisplay: 'Symbol Token • XYM',
	textCustomTokenDisplay: 'Custom Token • CTK'
};

// Token Fixtures

const tokenSymbol = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('1000')
	.build();

const tokenCustom = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('500')
	.build();

const tokenUnknown = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setAmount('250')
	.build();

const TOKEN_LIST = [tokenSymbol, tokenCustom, tokenUnknown];

// Dropdown Items

const DROPDOWN_ITEMS = [
	{ value: tokenSymbol.id, label: SCREEN_TEXT.textSymbolTokenDisplay },
	{ value: tokenCustom.id, label: SCREEN_TEXT.textCustomTokenDisplay },
	{ value: tokenUnknown.id, label: SCREEN_TEXT.textUnknownTokenName }
];

// Props Factory

const createDefaultProps = (overrides = {}) => ({
	label: SCREEN_TEXT.inputSelectTokenLabel,
	value: tokenSymbol.id,
	tokens: TOKEN_LIST,
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	onChange: jest.fn(),
	...overrides
});

// Tests

describe('components/SelectToken', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(SelectToken, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.inputSelectTokenLabel },
			{ type: 'text', value: SCREEN_TEXT.textSymbolTokenName }
		]
	});

	runDropdownSelectTest(SelectToken, {
		props: createDefaultProps(),
		textToPress: SCREEN_TEXT.textSymbolTokenName,
		items: DROPDOWN_ITEMS,
		testDisabledState: false
	});

	describe('token name resolution', () => {
		const runTokenNameResolutionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.props);

				// Act:
				const screenTester = new ScreenTester(SelectToken, props);

				// Assert:
				screenTester.expectText([expected.displayedName]);
			});
		};

		const tokenNameResolutionTests = [
			{
				description: 'displays resolved name from getTokenKnownInfo',
				config: { props: { value: tokenSymbol.id } },
				expected: { displayedName: SCREEN_TEXT.textSymbolTokenName }
			},
			{
				description: 'displays resolved name for custom token',
				config: { props: { value: tokenCustom.id } },
				expected: { displayedName: SCREEN_TEXT.textCustomTokenName }
			},
			{
				description: 'falls back to token.name when getTokenKnownInfo returns null',
				config: { props: { value: tokenUnknown.id } },
				expected: { displayedName: SCREEN_TEXT.textUnknownTokenName }
			}
		];

		tokenNameResolutionTests.forEach(test => {
			runTokenNameResolutionTest(test.description, test.config, test.expected);
		});
	});

	describe('token list', () => {
		it('renders all tokens in dropdown when opened', () => {
			// Arrange:
			const props = createDefaultProps();
			const screenTester = new ScreenTester(SelectToken, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textSymbolTokenName);

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSymbolTokenDisplay,
				SCREEN_TEXT.textCustomTokenDisplay,
				SCREEN_TEXT.textUnknownTokenName
			]);
		});
	});

	describe('onChange', () => {
		const runOnChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const onChangeMock = jest.fn();
				const props = createDefaultProps({ 
					value: config.initialValue, 
					onChange: onChangeMock 
				});
				const screenTester = new ScreenTester(SelectToken, props);

				// Act:
				screenTester.pressButton(config.triggerText);
				screenTester.pressButton(config.selectText);

				// Assert:
				expect(onChangeMock).toHaveBeenCalledWith(expected.selectedValue);
			});
		};

		const onChangeTests = [
			{
				description: 'calls onChange with custom token id when selected',
				config: { 
					initialValue: tokenSymbol.id, 
					triggerText: SCREEN_TEXT.textSymbolTokenName,
					selectText: SCREEN_TEXT.textCustomTokenDisplay
				},
				expected: { selectedValue: tokenCustom.id }
			},
			{
				description: 'calls onChange with unknown token id when selected',
				config: { 
					initialValue: tokenSymbol.id, 
					triggerText: SCREEN_TEXT.textSymbolTokenName,
					selectText: SCREEN_TEXT.textUnknownTokenName
				},
				expected: { selectedValue: tokenUnknown.id }
			},
			{
				description: 'calls onChange with symbol token id when selected from custom',
				config: { 
					initialValue: tokenCustom.id, 
					triggerText: SCREEN_TEXT.textCustomTokenName,
					selectText: SCREEN_TEXT.textSymbolTokenDisplay
				},
				expected: { selectedValue: tokenSymbol.id }
			}
		];

		onChangeTests.forEach(test => {
			runOnChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('empty token list', () => {
		it('renders label when tokens list is empty', () => {
			// Arrange:
			const props = createDefaultProps({ tokens: [], value: '' });

			// Act:
			const screenTester = new ScreenTester(SelectToken, props);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.inputSelectTokenLabel]);
		});
	});
});
