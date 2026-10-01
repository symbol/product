import '@testing-library/jest-dom';
import { accountHarvestedBlockPageResult, accountInfoResult } from '../test-utils/accounts';
import { clickText, runGetServerSidePropsTests, runRenderScenarioTests, runTestCases } from '../test-utils/page';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/app/api/accounts';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo, { getServerSideProps } from '@/app/pages/accounts/[address]';
import * as utils from '@/app/utils';
import { pageConfig } from '@/app/variants/page-config';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Mocks

jest.mock('@/app/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils')
	};
});

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

jest.mock('@/app/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/accounts')
	};
});

beforeEach(() => {
	jest.spyOn(utils, 'useUserCurrencyAmount').mockReturnValue(1000);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(transactionPageResult);
	jest.spyOn(AccountService, 'fetchAccountHarvestedBlockPage').mockResolvedValue({
		data: accountHarvestedBlockPageResult.data,
		pageNumber: 1
	});
});

// Constants

const SCREEN_TEXT = {
	sectionAccount: 'section_account',
	sectionLinkedKeys: 'section_linkedKeys',
	sectionMultisig: 'section_multisig',
	sectionHistory: 'section_history',
	sectionTransactions: 'section_transactions',
	sectionHarvested: 'section_harvested',
	labelLinked: 'label_linked',
	labelMultisig: 'label_multisig',
	fieldLinkedAccount: 'field_linkedAccount',
	fieldMainAccount: 'field_mainAccount',
	fieldMinCosignatories: 'field_minCosignatories',
	fieldAccountCosignatories: 'field_accountCosignatories',
	fieldCosignatoryOf: 'field_cosignatoryOf',
	messageNoLinkedKeys: 'message_noLinkedKeys',
	noDescription: 'No description',
	filterHideEmptyBlocks: 'filter_hideEmptyBlocks',
	buttonClear: 'button_clear',
	buttonTryAgain: 'button_tryAgain',
	tableFieldHeight: 'table_field_height',
	tableFieldType: 'table_field_type',
	tableFieldAmount: 'table_field_amount'
};

const linkedAccountAddress = 'NANQPLR63Z4ONDR3X6JQAC2HQCVPKI4ZDQ6OG6M4';
const cosignatoryAddresses = ['NANGHZNOAFIKE5QTGOLWP66I2SPJSYLRXY63EODH', 'NAEF6OBWJLW3CBM7U6QVCDRS4XAKBIC4VWACEGVL'];
const cosignatoryOfAddresses = ['NCYAVMNQOZ3MZETEBD34ACMAX3S57WUSWAZWY3DW'];
const harvestedBlockSearchCriteria = {
	pageNumber: 1,
	address: accountInfoResult.address
};

// Tests

describe('AccountInfo', () => {
	describe('getServerSideProps', () => {
		const requests = {
			accountInfo: [AccountService, 'fetchAccountInfo'],
			transactionPage: [TransactionService, 'fetchTransactionPage']
		};

		const getServerSidePropsCases = [
			{
				description: 'returns the account info and preloads transactions',
				config: {
					responses: {
						accountInfo: accountInfoResult,
						transactionPage: transactionPageResult
					}
				},
				expected: {
					requestArguments: {
						accountInfo: [accountInfoResult.address],
						transactionPage: [{ address: accountInfoResult.address }]
					},
					result: {
						props: {
							accountInfo: accountInfoResult,
							preloadedTransactions: transactionPageResult.data
						}
					}
				}
			},
			{
				description: 'returns not found without fetching transactions',
				config: {
					responses: { accountInfo: null }
				},
				expected: {
					requestArguments: { accountInfo: [accountInfoResult.address] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { address: accountInfoResult.address },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render scenarios', () => {
		const renderPage = config =>
			render(<AccountInfo accountInfo={{ ...accountInfoResult, ...config.accountInfo }} preloadedTransactions={[]} />);

		const renderScenarioCases = [
			{
				description: 'account section: renders the main account fields and mosaics',
				config: {},
				expected: {
					texts: [
						SCREEN_TEXT.sectionAccount,
						accountInfoResult.address,
						accountInfoResult.description,
						accountInfoResult.publicKey,
						accountInfoResult.height,
						`${accountInfoResult.importance} %`,
						...accountInfoResult.mosaics.map(mosaic => mosaic.id)
					],
					// The balance appears twice: the account balance field and the native mosaic row.
					textOccurrences: { [accountInfoResult.balance]: 2 },
					hiddenTexts: [SCREEN_TEXT.noDescription]
				}
			},
			{
				description: 'account section: renders the description placeholder when the description is missing',
				config: { accountInfo: { description: null } },
				expected: {
					texts: [SCREEN_TEXT.noDescription],
					hiddenTexts: [accountInfoResult.description]
				}
			},
			{
				description: 'account section: does not render the linked label for an ordinary account',
				config: {},
				expected: { hiddenTexts: [SCREEN_TEXT.labelLinked] }
			},
			{
				description: 'linked keys tab: renders the linked account field when a linked key exists',
				config: {
					accountInfo: { linkedAddress: linkedAccountAddress },
					actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)]
				},
				expected: {
					texts: [SCREEN_TEXT.fieldLinkedAccount, linkedAccountAddress],
					hiddenTexts: [SCREEN_TEXT.fieldMainAccount, SCREEN_TEXT.messageNoLinkedKeys]
				}
			},
			{
				description: 'linked keys tab: renders the main account field and the linked label for a remote account',
				config: {
					accountInfo: { mainAddress: linkedAccountAddress },
					actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)]
				},
				expected: {
					texts: [SCREEN_TEXT.labelLinked, SCREEN_TEXT.fieldMainAccount, linkedAccountAddress],
					hiddenTexts: [SCREEN_TEXT.fieldLinkedAccount, SCREEN_TEXT.messageNoLinkedKeys]
				}
			},
			{
				description: 'linked keys tab: renders the no linked keys message when the account has no keys',
				config: { actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)] },
				expected: {
					texts: [SCREEN_TEXT.messageNoLinkedKeys],
					hiddenTexts: [SCREEN_TEXT.fieldLinkedAccount, SCREEN_TEXT.fieldMainAccount]
				}
			},
			{
				description: 'multisig section: renders the cosignatory fields for a multisig account',
				config: {
					accountInfo: {
						cosignatories: cosignatoryAddresses,
						cosignatoryOf: cosignatoryOfAddresses,
						isMultisig: true
					}
				},
				expected: {
					texts: [
						SCREEN_TEXT.sectionMultisig,
						SCREEN_TEXT.labelMultisig,
						SCREEN_TEXT.fieldMinCosignatories,
						SCREEN_TEXT.fieldAccountCosignatories,
						SCREEN_TEXT.fieldCosignatoryOf,
						...cosignatoryAddresses,
						...cosignatoryOfAddresses
					]
				}
			},
			{
				description: 'multisig section: renders only the cosignatory of field for a cosignatory-only account',
				config: { accountInfo: { cosignatoryOf: cosignatoryOfAddresses } },
				expected: {
					texts: [SCREEN_TEXT.sectionMultisig, SCREEN_TEXT.fieldCosignatoryOf, ...cosignatoryOfAddresses],
					hiddenTexts: [SCREEN_TEXT.labelMultisig, SCREEN_TEXT.fieldMinCosignatories, SCREEN_TEXT.fieldAccountCosignatories]
				}
			},
			{
				description: 'multisig section: is not rendered for an ordinary account',
				config: {},
				expected: { hiddenTexts: [SCREEN_TEXT.sectionMultisig, SCREEN_TEXT.labelMultisig] }
			}
		];

		runRenderScenarioTests({ renderPage, cases: renderScenarioCases });
	});

	describe('account history', () => {
		const renderAccountInfo = () =>
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

		const renderHarvestedTab = () => {
			renderAccountInfo();
			fireEvent.click(screen.getByText(SCREEN_TEXT.sectionHarvested));
		};

		describe('history tabs', () => {
			const historyTabCases = [
				{
					description: 'renders the transactions tab',
					config: { actions: [clickText(SCREEN_TEXT.sectionTransactions)] },
					expected: {
						texts: [SCREEN_TEXT.sectionHistory],
						asyncTexts: transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'))
					}
				},
				{
					description: 'renders the harvested tab',
					config: { actions: [clickText(SCREEN_TEXT.sectionHarvested)] },
					expected: {
						texts: [SCREEN_TEXT.sectionHistory],
						asyncTexts: [
							SCREEN_TEXT.tableFieldHeight,
							SCREEN_TEXT.tableFieldType,
							SCREEN_TEXT.tableFieldAmount,
							...accountHarvestedBlockPageResult.data.map(block => block.height)
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage: renderAccountInfo, cases: historyTabCases });
		});

		describe('empty block filter', () => {
			// The chip ignores clicks while a request is in flight, so both actions wait for it to be enabled.
			const toggleEmptyBlockFilter = async () => {
				const filterChip = screen.getByText(SCREEN_TEXT.filterHideEmptyBlocks).closest('[role="button"]');
				await waitFor(() => expect(filterChip).toHaveAttribute('aria-disabled', 'false'));
				fireEvent.click(filterChip);
			};

			const clearEmptyBlockFilter = async () => {
				const filterChip = screen.getByText(SCREEN_TEXT.filterHideEmptyBlocks).closest('[role="button"]');
				await waitFor(() => expect(filterChip).toHaveAttribute('aria-disabled', 'false'));
				// The page renders a filter per history tab, so click the clear button next to the chip.
				fireEvent.click(within(filterChip.parentElement).getByText(SCREEN_TEXT.buttonClear));
			};

			const runEmptyBlockFilterTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					renderHarvestedTab();

					// Act:
					for (const filterAction of config.filterActions) {
						// eslint-disable-next-line no-await-in-loop
						await filterAction();
					}

					// Assert:
					await waitFor(() =>
						expect(AccountService.fetchAccountHarvestedBlockPage).toHaveBeenLastCalledWith(expected.searchCriteria));
				});
			};

			const emptyBlockFilterCases = [
				{
					description: 'asks for every harvested block by default',
					config: { filterActions: [] },
					expected: { searchCriteria: harvestedBlockSearchCriteria }
				},
				{
					description: 'leaves out empty blocks once the filter is selected',
					config: { filterActions: [toggleEmptyBlockFilter] },
					expected: { searchCriteria: { ...harvestedBlockSearchCriteria, isRewardedOnly: true } }
				},
				{
					description: 'shows empty blocks again when the filter chip is toggled off',
					config: { filterActions: [toggleEmptyBlockFilter, toggleEmptyBlockFilter] },
					expected: { searchCriteria: harvestedBlockSearchCriteria }
				},
				{
					description: 'shows empty blocks again when the filter is cleared',
					config: { filterActions: [toggleEmptyBlockFilter, clearEmptyBlockFilter] },
					expected: { searchCriteria: harvestedBlockSearchCriteria }
				}
			];

			runTestCases(runEmptyBlockFilterTest, emptyBlockFilterCases);

			it('does not render the filter when the variant disables it', async () => {
				// Arrange:
				jest.replaceProperty(pageConfig.account, 'showEmptyBlockFilter', false);

				// Act:
				renderHarvestedTab();

				// Assert:
				await waitFor(() => expect(screen.getByText(accountHarvestedBlockPageResult.data[0].height)).toBeInTheDocument());
				expect(screen.queryByText(SCREEN_TEXT.filterHideEmptyBlocks)).not.toBeInTheDocument();
			});
		});

		it('shows the try-again action when the harvested block request fails', async () => {
			// Arrange: silence the pagination error log.
			jest.spyOn(console, 'error').mockImplementation();
			AccountService.fetchAccountHarvestedBlockPage.mockRejectedValue(new Error('harvests request failed'));

			// Act:
			renderHarvestedTab();

			// Assert:
			await waitFor(() => expect(screen.getByText(SCREEN_TEXT.buttonTryAgain)).toBeInTheDocument());
		});
	});
});
