import { MultisigAccountWarning } from '@/app/components/feedback/MultisigAccountWarning';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Screen Text

const SCREEN_TEXT = {
	textWarningTitle: 'warning_multisig_title',
	textWarningBody: 'warning_multisig_body',
	textFieldCosignatories: 'fieldTitle_cosignatories'
};

// Account Fixtures

const firstCosignatoryAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const secondCosignatoryAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

const unknownCosignatoryAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build();

const walletAccounts = [firstCosignatoryAccount, secondCosignatoryAccount];

// Props

const createDefaultProps = (overrides = {}) => ({
	cosignatories: [firstCosignatoryAccount.address, secondCosignatoryAccount.address],
	chainName: CHAIN_NAME,
	...overrides
});

describe('components/MultisigAccountWarning', () => {
	beforeEach(() => {
		mockLocalization();
		mockWalletController({
			chainName: CHAIN_NAME,
			networkIdentifier: NETWORK_IDENTIFIER,
			accounts: { [NETWORK_IDENTIFIER]: walletAccounts }
		});
	});

	runRenderTextTest(MultisigAccountWarning, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.textWarningTitle },
			{ type: 'text', value: SCREEN_TEXT.textWarningBody },
			{ type: 'text', value: SCREEN_TEXT.textFieldCosignatories }
		]
	});

	describe('cosignatories table', () => {
		const runCosignatoriesTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps({ cosignatories: config.cosignatories });

				// Act:
				const screenTester = new ScreenTester(MultisigAccountWarning, props);

				// Assert:
				screenTester.expectText(expected.visibleTexts);

				if (expected.hiddenTexts)
					screenTester.notExpectText(expected.hiddenTexts);
			});
		};

		const cosignatoriesTests = [
			{
				description: 'renders the resolved names of the wallet cosignatories',
				config: {
					cosignatories: [firstCosignatoryAccount.address, secondCosignatoryAccount.address]
				},
				expected: {
					visibleTexts: [
						firstCosignatoryAccount.name,
						firstCosignatoryAccount.address,
						secondCosignatoryAccount.name,
						secondCosignatoryAccount.address
					]
				}
			},
			{
				description: 'renders only the address for an unknown cosignatory',
				config: {
					cosignatories: [unknownCosignatoryAccount.address]
				},
				expected: {
					visibleTexts: [unknownCosignatoryAccount.address],
					hiddenTexts: [unknownCosignatoryAccount.name]
				}
			},
			{
				description: 'renders a mix of resolved and unresolved cosignatories',
				config: {
					cosignatories: [firstCosignatoryAccount.address, unknownCosignatoryAccount.address]
				},
				expected: {
					visibleTexts: [
						firstCosignatoryAccount.name,
						firstCosignatoryAccount.address,
						unknownCosignatoryAccount.address
					],
					hiddenTexts: [unknownCosignatoryAccount.name]
				}
			}
		];

		cosignatoriesTests.forEach(test => {
			runCosignatoriesTest(test.description, test.config, test.expected);
		});
	});
});
