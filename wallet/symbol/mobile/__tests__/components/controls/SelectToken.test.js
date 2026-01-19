import { SelectToken } from '@/app/components/controls/SelectToken';
import { runDropdownSelectTest, runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

jest.mock('@/app/utils', () => ({
	getTokenKnownInfo: (chainName, networkIdentifier, tokenId) => {
		const tokenInfoMap = {
			'token1': { name: 'Symbol Token', ticker: 'XYM', imageId: 'symbol' },
			'token2': { name: 'Custom Token', ticker: 'CTK', imageId: 'custom' },
			'token3': { name: null, ticker: null, imageId: null }
		};
		return tokenInfoMap[tokenId] || {};
	}
}));

describe('components/SelectToken', () => {
	const defaultTokens = [
		{ id: 'token1', name: 'Symbol', amount: '1000' },
		{ id: 'token2', name: 'Custom', amount: '500' },
		{ id: 'token3', name: 'Unknown Token', amount: '250' }
	];

	const createProps = ({ label, value, tokens, chainName, networkIdentifier } = {}) => ({
		label: label ?? 'Select Token',
		value: value ?? 'token1',
		tokens: tokens ?? defaultTokens,
		chainName: chainName ?? 'symbol',
		networkIdentifier: networkIdentifier ?? 'mainnet',
		onChange: jest.fn()
	});

	runRenderTextTest(SelectToken, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Select Token' },
			{ type: 'text', value: 'Symbol Token' }
		]
	});

	// Build items list matching what the component builds from tokens + getTokenKnownInfo
	// In the modal, TokenView shows "Name • Ticker" format
	const dropdownItems = [
		{ value: 'token1', label: 'Symbol Token • XYM' },
		{ value: 'token2', label: 'Custom Token • CTK' },
		{ value: 'token3', label: 'Unknown Token' }
	];

	runDropdownSelectTest(SelectToken, {
		props: createProps(),
		textToPress: 'Symbol Token',
		items: dropdownItems,
		testDisabledState: false
	});

	describe('token name resolution', () => {
		const runTokenNameTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { getByText } = render(<SelectToken {...props} />);

				// Assert:
				expect(getByText(expected.displayedName)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'displays resolved name from getTokenKnownInfo',
				config: {
					props: { value: 'token1' }
				},
				expected: {
					displayedName: 'Symbol Token'
				}
			},
			{
				description: 'falls back to token.name when getTokenKnownInfo returns null name',
				config: {
					props: { value: 'token3' }
				},
				expected: {
					displayedName: 'Unknown Token'
				}
			}
		];

		tests.forEach(test => {
			runTokenNameTest(test.description, test.config, test.expected);
		});
	});

	describe('token list', () => {
		it('renders all tokens in dropdown when opened', async () => {
			// Arrange:
			const props = createProps();
			const { getByText, findByText } = render(<SelectToken {...props} />);

			// Act:
			const trigger = getByText('Symbol Token');
			const { fireEvent } = require('@testing-library/react-native');
			fireEvent.press(trigger);

			// Assert:
			// Token names are displayed with tickers in TokenView: "Name • Ticker"
			const token1 = await findByText('Symbol Token • XYM');
			const token2 = await findByText('Custom Token • CTK');
			const token3 = await findByText('Unknown Token');
			
			expect(token1).toBeTruthy();
			expect(token2).toBeTruthy();
			expect(token3).toBeTruthy();
		});
	});
});
