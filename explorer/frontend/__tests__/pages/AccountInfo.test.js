import '@testing-library/jest-dom';
import { cosignatoryAccount, harvestingAccount, multisigAccount, remoteAccount } from '../../__fixtures__/local/account';
import { accountHarvestedBlockList } from '../../__fixtures__/local/account-harvested-block-list';
import { accountTransactionListConfirmed } from '../../__fixtures__/local/transaction-list-confirmed';
import {
	clearFilterChip,
	clickText,
	runGetServerSidePropsTests,
	runRenderScenarioTests,
	runSearchCriteriaTests,
	runTableErrorTest,
	toggleFilterChip
} from '../test-utils/page';
import { describeVariant } from '../test-utils/variants';
import * as AccountService from '@/app/api/accounts';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo, { getServerSideProps } from '@/app/pages/accounts/[address]';
import { truncateString } from '@/app/utils';
import { fireEvent, render, screen } from '@testing-library/react';

// Mocks

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

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

beforeEach(() => {
	jest.spyOn(StatsService, 'fetchPriceByDate').mockResolvedValue(mockedMosaicPrice);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(accountTransactionPage);
	jest.spyOn(AccountService, 'fetchAccountHarvestedBlockPage').mockResolvedValue(harvestedBlockPage);
});

// Constants

const SCREEN_TEXT = {
	sectionAccount: 'section_account',
	sectionLinkedKeys: 'section_linkedKeys',
	sectionMultisig: 'section_multisig',
	sectionHistory: 'section_history',
	sectionTransactions: 'section_transactions',
	sectionHarvested: 'section_harvested',
	labelHarvesting: 'label_harvesting',
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
	tableFieldHeight: 'table_field_height',
	tableFieldType: 'table_field_type',
	tableFieldAmount: 'table_field_amount'
};

const mockedMosaicPrice = 0.5;
const balanceInUserCurrencyText = `~${cosignatoryAccount.balance * mockedMosaicPrice} USD`;
const accountDescription = 'Account description text..';
const accountTransactionPage = {
	data: accountTransactionListConfirmed,
	pageNumber: 1
};
const harvestedBlockPage = {
	data: accountHarvestedBlockList,
	pageNumber: 1
};
const harvestedBlockSearchCriteria = {
	pageNumber: 1,
	address: harvestingAccount.address
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
				description: 'returns the account info and preloaded transactions props',
				config: {
					responses: {
						accountInfo: cosignatoryAccount,
						transactionPage: accountTransactionPage
					}
				},
				expected: {
					requestArguments: {
						accountInfo: [cosignatoryAccount.address],
						transactionPage: [{ address: cosignatoryAccount.address }]
					},
					result: {
						props: {
							accountInfo: cosignatoryAccount,
							preloadedTransactions: accountTransactionListConfirmed
						}
					}
				}
			},
			{
				description: 'returns not found when the account does not exist, without fetching transactions',
				config: {
					responses: { accountInfo: null }
				},
				expected: {
					requestArguments: { accountInfo: [cosignatoryAccount.address] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { address: cosignatoryAccount.address },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config =>
			render(<AccountInfo accountInfo={config.accountInfo} preloadedTransactions={config.preloadedTransactions ?? []} />);

		describe('section: account info', () => {
			const accountInfoCases = [
				{
					description: 'renders the main account fields and mosaics',
					config: { accountInfo: cosignatoryAccount },
					expected: {
						texts: [
							SCREEN_TEXT.sectionAccount,
							cosignatoryAccount.address,
							cosignatoryAccount.publicKey,
							cosignatoryAccount.height,
							`${cosignatoryAccount.importance} %`,
							...cosignatoryAccount.mosaics.map(mosaic => mosaic.id)
						],
						// The balance appears twice: the account balance field and the native mosaic row.
						textOccurrences: { [cosignatoryAccount.balance]: 2 },
						asyncTexts: [balanceInUserCurrencyText]
					}
				},
				{
					description: 'renders the description when the description is present',
					config: {
						accountInfo: {
							...harvestingAccount,
							description: accountDescription
						}
					},
					expected: {
						texts: [accountDescription],
						hiddenTexts: [SCREEN_TEXT.noDescription]
					}
				},
				{
					description: 'renders the description placeholder when the description is missing',
					config: { accountInfo: cosignatoryAccount },
					expected: { texts: [SCREEN_TEXT.noDescription] }
				},
				{
					description: 'renders the harvesting label when the account is harvesting',
					config: { accountInfo: harvestingAccount },
					expected: { texts: [SCREEN_TEXT.labelHarvesting] }
				},
				{
					description: 'does not render the harvesting label when the account does not harvest',
					config: { accountInfo: cosignatoryAccount },
					expected: { hiddenTexts: [SCREEN_TEXT.labelHarvesting] }
				},
				{
					description: 'does not render the linked label when the account is not remote',
					config: { accountInfo: harvestingAccount },
					expected: { hiddenTexts: [SCREEN_TEXT.labelLinked] }
				}
			];

			runRenderScenarioTests({ renderPage, cases: accountInfoCases });
		});

		describe('section: linked keys', () => {
			const linkedKeysCases = [
				{
					description: 'renders the linked account field when a linked key exists',
					config: {
						accountInfo: cosignatoryAccount,
						actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)]
					},
					expected: {
						texts: [SCREEN_TEXT.fieldLinkedAccount, cosignatoryAccount.linkedAddress],
						hiddenTexts: [SCREEN_TEXT.fieldMainAccount, SCREEN_TEXT.messageNoLinkedKeys]
					}
				},
				{
					description: 'renders the main account field and the linked label when the account is remote',
					config: {
						accountInfo: remoteAccount,
						actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)]
					},
					expected: {
						texts: [SCREEN_TEXT.labelLinked, SCREEN_TEXT.fieldMainAccount, remoteAccount.mainAddress],
						hiddenTexts: [SCREEN_TEXT.fieldLinkedAccount, SCREEN_TEXT.messageNoLinkedKeys]
					}
				},
				{
					description: 'renders the no linked keys message when the account has no keys',
					config: {
						accountInfo: harvestingAccount,
						actions: [clickText(SCREEN_TEXT.sectionLinkedKeys)]
					},
					expected: {
						texts: [SCREEN_TEXT.messageNoLinkedKeys],
						hiddenTexts: [SCREEN_TEXT.fieldLinkedAccount, SCREEN_TEXT.fieldMainAccount]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: linkedKeysCases });
		});

		describe('section: multisig', () => {
			const multisigCases = [
				{
					description: 'renders the cosignatory fields when the account is multisig',
					config: { accountInfo: multisigAccount },
					expected: {
						texts: [
							SCREEN_TEXT.sectionMultisig,
							SCREEN_TEXT.labelMultisig,
							SCREEN_TEXT.fieldMinCosignatories,
							SCREEN_TEXT.fieldAccountCosignatories,
							...multisigAccount.cosignatories
						],
						hiddenTexts: [SCREEN_TEXT.fieldCosignatoryOf]
					}
				},
				{
					description: 'renders only the cosignatory of field when the account is a cosignatory but not multisig',
					config: { accountInfo: cosignatoryAccount },
					expected: {
						texts: [SCREEN_TEXT.sectionMultisig, SCREEN_TEXT.fieldCosignatoryOf, ...cosignatoryAccount.cosignatoryOf],
						hiddenTexts: [SCREEN_TEXT.labelMultisig, SCREEN_TEXT.fieldMinCosignatories, SCREEN_TEXT.fieldAccountCosignatories]
					}
				},
				{
					description: 'does not render the multisig section when the account is neither multisig nor a cosignatory',
					config: { accountInfo: harvestingAccount },
					expected: { hiddenTexts: [SCREEN_TEXT.sectionMultisig, SCREEN_TEXT.labelMultisig] }
				}
			];

			runRenderScenarioTests({ renderPage, cases: multisigCases });
		});

		describe('section: history', () => {
			const renderHarvestedTab = () => {
				renderPage({ accountInfo: harvestingAccount });
				fireEvent.click(screen.getByText(SCREEN_TEXT.sectionHarvested));
			};

			const historyCases = [
				{
					description: 'renders the transaction hashes when the transactions tab is selected',
					config: {
						accountInfo: cosignatoryAccount,
						preloadedTransactions: accountTransactionListConfirmed,
						actions: [clickText(SCREEN_TEXT.sectionTransactions)]
					},
					expected: {
						texts: [SCREEN_TEXT.sectionHistory],
						asyncTexts: accountTransactionListConfirmed.map(transaction => truncateString(transaction.hash, 'hash'))
					}
				},
				{
					description: 'renders the harvested block heights when the harvested tab is selected',
					config: {
						accountInfo: harvestingAccount,
						actions: [clickText(SCREEN_TEXT.sectionHarvested)]
					},
					expected: {
						texts: [SCREEN_TEXT.sectionHistory],
						asyncTexts: [
							SCREEN_TEXT.tableFieldHeight,
							SCREEN_TEXT.tableFieldType,
							SCREEN_TEXT.tableFieldAmount,
							...accountHarvestedBlockList.map(block => block.height)
						]
					}
				},
				{
					description: 'renders the empty block filter chip',
					variants: ['nem'],
					config: {
						accountInfo: harvestingAccount,
						actions: [clickText(SCREEN_TEXT.sectionHarvested)]
					},
					expected: {
						asyncTexts: [accountHarvestedBlockList[0].height],
						texts: [SCREEN_TEXT.filterHideEmptyBlocks]
					}
				},
				{
					description: 'does not render the empty block filter chip',
					variants: ['symbol'],
					config: {
						accountInfo: harvestingAccount,
						actions: [clickText(SCREEN_TEXT.sectionHarvested)]
					},
					expected: {
						asyncTexts: [accountHarvestedBlockList[0].height],
						hiddenTexts: [SCREEN_TEXT.filterHideEmptyBlocks]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: historyCases });

			runSearchCriteriaTests({
				renderPage: renderHarvestedTab,
				request: [AccountService, 'fetchAccountHarvestedBlockPage'],
				cases: [
					{
						description: 'requests every harvested block by default',
						config: { actions: [] },
						expected: { searchCriteria: harvestedBlockSearchCriteria }
					}
				]
			});

			runTableErrorTest('renders the try-again action when the harvested block request fails', {
				renderPage: renderHarvestedTab,
				request: [AccountService, 'fetchAccountHarvestedBlockPage']
			});

			describeVariant('nem')('empty block filter', () => {
				const toggleEmptyBlockFilter = toggleFilterChip(SCREEN_TEXT.filterHideEmptyBlocks);
				const clearEmptyBlockFilter = clearFilterChip(SCREEN_TEXT.filterHideEmptyBlocks);

				const emptyBlockFilterCases = [
					{
						description: 'requests only the rewarded blocks when the empty block filter is selected',
						config: { actions: [toggleEmptyBlockFilter] },
						expected: { searchCriteria: { ...harvestedBlockSearchCriteria, isRewardedOnly: true } }
					},
					{
						description: 'requests every harvested block when the empty block filter is deselected',
						config: { actions: [toggleEmptyBlockFilter, toggleEmptyBlockFilter] },
						expected: { searchCriteria: harvestedBlockSearchCriteria }
					},
					{
						description: 'requests every harvested block when the empty block filter is cleared',
						config: { actions: [toggleEmptyBlockFilter, clearEmptyBlockFilter] },
						expected: { searchCriteria: harvestedBlockSearchCriteria }
					}
				];

				runSearchCriteriaTests({
					renderPage: renderHarvestedTab,
					request: [AccountService, 'fetchAccountHarvestedBlockPage'],
					cases: emptyBlockFilterCases
				});
			});
		});
	});
});
