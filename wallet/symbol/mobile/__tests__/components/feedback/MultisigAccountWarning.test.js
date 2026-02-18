import { MultisigAccountWarning } from '@/app/components/feedback/MultisigAccountWarning';
import { runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

jest.mock('@/app/localization', () => ({
	$t: jest.fn(key => {
		const translations = {
			'warning_multisig_title': 'Multisig Account',
			'warning_multisig_body': 'This is a multisig account.',
			'fieldTitle_cosignatories': 'Cosignatories'
		};
		return translations[key] || key;
	})
}));

jest.mock('@/app/utils', () => ({
	getAccountKnownInfo: address => {
		const accountInfoMap = {
			'TADDRESS1': { name: 'Alice', imageId: 'alice' },
			'TADDRESS2': { name: 'Bob', imageId: 'bob' },
			'TADDRESS3': { name: null, imageId: null }
		};
		return accountInfoMap[address] || { name: null, imageId: null };
	},
	getTokenKnownInfo: () => ({ name: null, ticker: null, imageId: null })
}));

describe('components/MultisigAccountWarning', () => {
	const createProps = ({
		cosignatories,
		addressBook,
		accounts,
		chainName,
		networkIdentifier
	} = {}) => ({
		cosignatories: cosignatories ?? ['TADDRESS1', 'TADDRESS2'],
		addressBook: addressBook ?? {},
		accounts: accounts ?? { mainnet: [] },
		chainName: chainName ?? 'symbol',
		networkIdentifier: networkIdentifier ?? 'mainnet'
	});

	runRenderTextTest(MultisigAccountWarning, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Multisig Account' },
			{ type: 'text', value: 'This is a multisig account.' }
		]
	});

	describe('alert', () => {
		it('renders warning alert with correct title and body', () => {
			// Arrange:
			const props = createProps();

			// Act:
			const { getByText } = render(<MultisigAccountWarning {...props} />);

			// Assert:
			expect(getByText('Multisig Account')).toBeTruthy();
			expect(getByText('This is a multisig account.')).toBeTruthy();
		});
	});

	describe('cosignatories table', () => {
		const runCosignatoriesTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByText, queryAllByText } = render(<MultisigAccountWarning {...props} />);

				// Assert:
				expected.visibleTexts.forEach(text => {
					const elements = queryAllByText(text);
					expect(elements.length).toBeGreaterThan(0);
				});

				if (expected.hiddenTexts) {
					expected.hiddenTexts.forEach(text => {
						expect(queryByText(text)).toBeNull();
					});
				}
			});
		};

		const tests = [
			{
				description: 'renders cosignatories with resolved names',
				config: {
					props: {
						cosignatories: ['TADDRESS1', 'TADDRESS2']
					}
				},
				expected: {
					visibleTexts: ['Cosignatories', 'Alice', 'TADDRESS1', 'Bob', 'TADDRESS2']
				}
			},
			{
				description: 'renders cosignatories without names when not resolved',
				config: {
					props: {
						cosignatories: ['TADDRESS3']
					}
				},
				expected: {
					visibleTexts: ['Cosignatories', 'TADDRESS3']
				}
			},
			{
				description: 'renders single cosignatory',
				config: {
					props: {
						cosignatories: ['TADDRESS1']
					}
				},
				expected: {
					visibleTexts: ['Cosignatories', 'Alice', 'TADDRESS1']
				}
			},
			{
				description: 'renders multiple cosignatories with mixed resolution',
				config: {
					props: {
						cosignatories: ['TADDRESS1', 'TADDRESS3']
					}
				},
				expected: {
					visibleTexts: ['Cosignatories', 'Alice', 'TADDRESS1', 'TADDRESS3']
				}
			}
		];

		tests.forEach(test => {
			runCosignatoriesTest(test.description, test.config, test.expected);
		});
	});
});
