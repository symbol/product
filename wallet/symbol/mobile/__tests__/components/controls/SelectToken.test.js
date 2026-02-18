import { SelectToken } from '@/app/components/controls/SelectToken';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { runDropdownSelectTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';

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

const SCREEN_TEXT = {
	selectTokenLabel: 'select_token',
	textSymbolTokenName: 'Symbol Token',
	textCustomTokenName: 'Custom Token',
	textUnknownTokenName: 'Test Token 2',
	textSymbolTokenDisplay: 'Symbol Token • XYM',
	textCustomTokenDisplay: 'Custom Token • CTK'
};

const TOKEN_SYMBOL = TokenFixtureBuilder
	.createWithToken('symbol', 'mainnet', 0)
	.setAmount('1000')
	.build();

const TOKEN_CUSTOM = TokenFixtureBuilder
	.createWithToken('symbol', 'mainnet', 1)
	.setAmount('500')
	.build();

const TOKEN_UNKNOWN = TokenFixtureBuilder
	.createWithToken('symbol', 'mainnet', 2)
	.setAmount('250')
	.build();

const TOKEN_LIST = [TOKEN_SYMBOL, TOKEN_CUSTOM, TOKEN_UNKNOWN];

const DROPDOWN_ITEMS = [
	{ value: TOKEN_SYMBOL.id, label: SCREEN_TEXT.textSymbolTokenDisplay },
	{ value: TOKEN_CUSTOM.id, label: SCREEN_TEXT.textCustomTokenDisplay },
	{ value: TOKEN_UNKNOWN.id, label: SCREEN_TEXT.textUnknownTokenName }
];

const createDefaultProps = (overrides = {}) => ({
	label: SCREEN_TEXT.selectTokenLabel,
	value: TOKEN_SYMBOL.id,
	tokens: TOKEN_LIST,
	chainName: 'symbol',
	networkIdentifier: 'mainnet',
	onChange: jest.fn(),
	...overrides
});


describe('components/SelectToken', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(SelectToken, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.selectTokenLabel },
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
				const { getByText } = render(<SelectToken {...props} />);

				// Assert:
				expect(getByText(expected.displayedName)).toBeTruthy();
			});
		};

		const tokenNameResolutionTests = [
			{
				description: 'displays resolved name from getTokenKnownInfo',
				config: { props: { value: TOKEN_SYMBOL.id } },
				expected: { displayedName: SCREEN_TEXT.textSymbolTokenName }
			},
			{
				description: 'displays resolved name for custom token',
				config: { props: { value: TOKEN_CUSTOM.id } },
				expected: { displayedName: SCREEN_TEXT.textCustomTokenName }
			},
			{
				description: 'falls back to token.name when getTokenKnownInfo returns null',
				config: { props: { value: TOKEN_UNKNOWN.id } },
				expected: { displayedName: SCREEN_TEXT.textUnknownTokenName }
			}
		];

		tokenNameResolutionTests.forEach(test => {
			runTokenNameResolutionTest(test.description, test.config, test.expected);
		});
	});

	describe('token list', () => {
		it('renders all tokens in dropdown when opened', async () => {
			// Arrange:
			const props = createDefaultProps();
			const { getByText, findByText } = render(<SelectToken {...props} />);

			// Act:
			const trigger = getByText(SCREEN_TEXT.textSymbolTokenName);
			fireEvent.press(trigger);

			// Assert:
			const symbolToken = await findByText(SCREEN_TEXT.textSymbolTokenDisplay);
			const customToken = await findByText(SCREEN_TEXT.textCustomTokenDisplay);
			const unknownToken = await findByText(SCREEN_TEXT.textUnknownTokenName);
			
			expect(symbolToken).toBeTruthy();
			expect(customToken).toBeTruthy();
			expect(unknownToken).toBeTruthy();
		});
	});

	describe('onChange', () => {
		const runOnChangeTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const onChangeMock = jest.fn();
				const props = createDefaultProps({ 
					value: config.initialValue, 
					onChange: onChangeMock 
				});
				const { getByText, findByText } = render(<SelectToken {...props} />);

				// Act:
				const trigger = getByText(config.triggerText);
				fireEvent.press(trigger);
				const tokenOption = await findByText(config.selectText);
				fireEvent.press(tokenOption);

				// Assert:
				expect(onChangeMock).toHaveBeenCalledWith(expected.selectedValue);
			});
		};

		const onChangeTests = [
			{
				description: 'calls onChange with custom token id when selected',
				config: { 
					initialValue: TOKEN_SYMBOL.id, 
					triggerText: SCREEN_TEXT.textSymbolTokenName,
					selectText: SCREEN_TEXT.textCustomTokenDisplay
				},
				expected: { selectedValue: TOKEN_CUSTOM.id }
			},
			{
				description: 'calls onChange with unknown token id when selected',
				config: { 
					initialValue: TOKEN_SYMBOL.id, 
					triggerText: SCREEN_TEXT.textSymbolTokenName,
					selectText: SCREEN_TEXT.textUnknownTokenName
				},
				expected: { selectedValue: TOKEN_UNKNOWN.id }
			},
			{
				description: 'calls onChange with symbol token id when selected from custom',
				config: { 
					initialValue: TOKEN_CUSTOM.id, 
					triggerText: SCREEN_TEXT.textCustomTokenName,
					selectText: SCREEN_TEXT.textSymbolTokenDisplay
				},
				expected: { selectedValue: TOKEN_SYMBOL.id }
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
			const { getByText } = render(<SelectToken {...props} />);

			// Assert:
			expect(getByText(SCREEN_TEXT.selectTokenLabel)).toBeTruthy();
		});
	});
});
