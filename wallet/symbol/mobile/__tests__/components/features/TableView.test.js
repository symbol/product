import { TableView } from '@/app/components/features/TableView';
import { runRenderComponentTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { render } from '@testing-library/react-native';

jest.mock('@/app/localization', () => ({
	$t: jest.fn(key => key)
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
	getTokenKnownInfo: (chainName, networkIdentifier, tokenId) => {
		const tokenInfoMap = {
			'token1': { name: 'Symbol', ticker: 'XYM', imageId: 'symbol' },
			'token2': { name: 'Custom Token', ticker: 'CTK', imageId: 'custom' }
		};
		return tokenInfoMap[tokenId] || { name: null, ticker: null, imageId: null };
	}
}));

describe('components/TableView', () => {
	const createProps = ({
		data,
		addressBook,
		walletAccounts,
		chainName,
		networkIdentifier,
		isTitleTranslatable,
		showEmptyArrays
	} = {}) => ({
		data: data ?? [],
		addressBook: addressBook ?? {},
		walletAccounts: walletAccounts ?? { mainnet: [] },
		chainName: chainName ?? 'symbol',
		networkIdentifier: networkIdentifier ?? 'mainnet',
		isTitleTranslatable: isTitleTranslatable ?? false,
		showEmptyArrays: showEmptyArrays ?? false
	});

	describe('render', () => {
		runRenderComponentTest(TableView, {
			props: createProps({ data: [] })
		});

		runRenderTextTest(TableView, {
			props: createProps({
				data: [
					{ title: 'Name', type: 'text', value: 'Test Value' }
				]
			}),
			textToRender: [
				{ type: 'text', value: 'Name' },
				{ type: 'text', value: 'Test Value' }
			]
		});
	});

	describe('row types', () => {
		const runRowTypeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByText, queryAllByText } = render(<TableView {...props} />);

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
				description: 'renders text row type',
				config: {
					props: {
						data: [
							{ title: 'Description', type: 'text', value: 'Sample text' }
						]
					}
				},
				expected: {
					visibleTexts: ['Description', 'Sample text']
				}
			},
			{
				description: 'renders account row type with resolved name',
				config: {
					props: {
						data: [
							{ title: 'Sender', type: 'account', value: 'TADDRESS1' }
						]
					}
				},
				expected: {
					visibleTexts: ['Sender', 'Alice', 'TADDRESS1']
				}
			},
			{
				description: 'renders account row type without name when not resolved',
				config: {
					props: {
						data: [
							{ title: 'Sender', type: 'account', value: 'TADDRESS3' }
						]
					}
				},
				expected: {
					visibleTexts: ['Sender', 'TADDRESS3']
				}
			},
			{
				description: 'renders token row type with resolved info',
				config: {
					props: {
						data: [
							{ title: 'Token', type: 'token', value: { id: 'token1', amount: '100' } }
						]
					}
				},
				expected: {
					visibleTexts: ['Token', 'Symbol • XYM', '100']
				}
			},
			{
				description: 'renders fee row type',
				config: {
					props: {
						data: [
							{ title: 'Fee', type: 'fee', value: { token: { id: 'token1', amount: '0.5' } } }
						]
					}
				},
				expected: {
					visibleTexts: ['Fee', 'Symbol • XYM', '0.5']
				}
			},
			{
				description: 'renders copy row type',
				config: {
					props: {
						data: [
							{ title: 'Hash', type: 'copy', value: 'ABC123' }
						]
					}
				},
				expected: {
					visibleTexts: ['Hash', 'ABC123']
				}
			},
			{
				description: 'renders boolean row type with true value',
				config: {
					props: {
						data: [
							{ title: 'Active', type: 'boolean', value: true }
						]
					}
				},
				expected: {
					visibleTexts: ['Active', 'data_true']
				}
			},
			{
				description: 'renders boolean row type with false value',
				config: {
					props: {
						data: [
							{ title: 'Active', type: 'boolean', value: false }
						]
					}
				},
				expected: {
					visibleTexts: ['Active', 'data_false']
				}
			},
			{
				description: 'renders encryption row type with encrypted value',
				config: {
					props: {
						data: [
							{ title: 'Message', type: 'encryption', value: true }
						]
					}
				},
				expected: {
					visibleTexts: ['Message', 'data_encrypted']
				}
			},
			{
				description: 'renders encryption row type with unencrypted value',
				config: {
					props: {
						data: [
							{ title: 'Message', type: 'encryption', value: false }
						]
					}
				},
				expected: {
					visibleTexts: ['Message', 'data_unencrypted']
				}
			},
			{
				description: 'renders translate row type',
				config: {
					props: {
						data: [
							{ title: 'Status', type: 'translate', value: 'pending' }
						]
					}
				},
				expected: {
					visibleTexts: ['Status', 'data_pending']
				}
			}
		];

		tests.forEach(test => {
			runRowTypeTest(test.description, test.config, test.expected);
		});
	});

	describe('array values', () => {
		const runArrayValueTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryAllByText } = render(<TableView {...props} />);

				// Assert:
				expected.visibleTexts.forEach(text => {
					const elements = queryAllByText(text);
					expect(elements.length).toBeGreaterThan(0);
				});
			});
		};

		const tests = [
			{
				description: 'renders multiple account values in a row',
				config: {
					props: {
						data: [
							{ title: 'Cosignatories', type: 'account', value: ['TADDRESS1', 'TADDRESS2'] }
						]
					}
				},
				expected: {
					visibleTexts: ['Cosignatories', 'Alice', 'TADDRESS1', 'Bob', 'TADDRESS2']
				}
			},
			{
				description: 'renders dash for empty array values',
				config: {
					props: {
						data: [
							{ title: 'Recipients', type: 'account', value: [] }
						],
						showEmptyArrays: true
					}
				},
				expected: {
					visibleTexts: ['Recipients', '-']
				}
			}
		];

		tests.forEach(test => {
			runArrayValueTest(test.description, test.config, test.expected);
		});
	});

	describe('title translation', () => {
		beforeEach(() => {
			mockLocalization({
				'fieldTitle_sender': 'Sender Address',
				'fieldTitle_amount': 'Transfer Amount'
			});
		});

		const runTitleTranslationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByText, queryAllByText } = render(<TableView {...props} />);

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
				description: 'translates titles when isTitleTranslatable is true',
				config: {
					props: {
						data: [
							{ title: 'sender', type: 'text', value: 'TADDRESS1' }
						],
						isTitleTranslatable: true
					}
				},
				expected: {
					visibleTexts: ['Sender Address']
				}
			},
			{
				description: 'does not translate titles when isTitleTranslatable is false',
				config: {
					props: {
						data: [
							{ title: 'sender', type: 'text', value: 'TADDRESS1' }
						],
						isTitleTranslatable: false
					}
				},
				expected: {
					visibleTexts: ['sender'],
					hiddenTexts: ['Sender Address']
				}
			}
		];

		tests.forEach(test => {
			runTitleTranslationTest(test.description, test.config, test.expected);
		});
	});

	describe('edge cases', () => {
		const runEdgeCaseTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const baseProps = createProps({});
				const props = { ...baseProps, ...config.props };

				// Act:
				const { queryByText } = render(<TableView {...props} />);

				// Assert:
				if (expected.visibleTexts) {
					expected.visibleTexts.forEach(text => {
						expect(queryByText(text)).toBeTruthy();
					});
				}
			});
		};

		const tests = [
			{
				description: 'renders empty table when data is empty array',
				config: {
					props: { data: [] }
				},
				expected: {}
			}
		];

		tests.forEach(test => {
			runEdgeCaseTest(test.description, test.config, test.expected);
		});

		it('throws error when data is null', () => {
			// Arrange:
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
			const baseProps = createProps({});
			const props = { ...baseProps, data: null };

			// Act & Assert:
			expect(() => render(<TableView {...props} />)).toThrow();

			consoleError.mockRestore();
		});

		it('throws error when data is undefined', () => {
			// Arrange:
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
			const baseProps = createProps({});
			const props = { ...baseProps, data: undefined };

			// Act & Assert:
			expect(() => render(<TableView {...props} />)).toThrow();

			consoleError.mockRestore();
		});
	});
});
