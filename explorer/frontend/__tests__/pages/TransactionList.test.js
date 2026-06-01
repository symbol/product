import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import { transactionStatisticsResult } from '../test-utils/stats';
import { transactionPageResult } from '../test-utils/transactions';
import * as StatsService from '@/api/stats';
import * as TransactionService from '@/api/transactions';
import config from '@/config';
import TransactionList, { getServerSideProps } from '@/pages/transactions/index';
import * as utils from '@/utils';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('TransactionList', () => {
	const originalNativeMosaicId = config.NATIVE_MOSAIC_ID;
	const originalNativeMosaicTicker = config.NATIVE_MOSAIC_TICKER;
	const originalTransactionsPageConfig = pageConfig.transactions;
	const symbolTransactionValueTypeGroups = {
		mosaicDetailsHidden: ['TRANSFER', 'HASH_LOCK'],
		aliasAction: ['ADDRESS_ALIAS', 'MOSAIC_ALIAS'],
		keyLinkAction: ['ACCOUNT_KEY_LINK', 'NODE_KEY_LINK', 'VOTING_KEY_LINK', 'VRF_KEY_LINK'],
		restrictionAction: ['ACCOUNT_ADDRESS_RESTRICTION', 'ACCOUNT_MOSAIC_RESTRICTION', 'ACCOUNT_OPERATION_RESTRICTION'],
		mosaicSupplyAction: ['MOSAIC_SUPPLY_CHANGE'],
		namespaceRegistration: ['NAMESPACE_REGISTRATION'],
		secretLock: ['SECRET_LOCK'],
		secretProof: ['SECRET_PROOF']
	};

	beforeEach(() => {
		pageConfig.transactions = {
			...pageConfig.transactions,
			valueTypeGroups: symbolTransactionValueTypeGroups
		};
	});

	afterEach(() => {
		config.NATIVE_MOSAIC_ID = originalNativeMosaicId;
		config.NATIVE_MOSAIC_TICKER = originalNativeMosaicTicker;
		pageConfig.transactions = originalTransactionsPageConfig;
	});

	describe('getServerSideProps', () => {
		it('fetches transaction list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);
			const fetchTransactionStats = jest.spyOn(StatsService, 'fetchTransactionStats');
			fetchTransactionStats.mockResolvedValue(transactionStatisticsResult);
			const expectedResult = {
				props: {
					preloadedData: transactionPageResult.data,
					stats: transactionStatisticsResult
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledWith();
			expect(fetchTransactionStats).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_transactions';
			const transactionHashes = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act:
			render(<TransactionList preloadedData={transactionPageResult.data} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			transactionHashes.forEach(hash => {
				expect(screen.getByText(hash)).toBeInTheDocument();
			});
		};

		it('renders page with the list of transactions on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of transactions on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});

		it('hides non-native Transfer mosaic value details when configured', () => {
			// Arrange:
			config.NATIVE_MOSAIC_ID = 'nem.xem';
			config.NATIVE_MOSAIC_TICKER = 'XEM';
			pageConfig.transactions = {
				...pageConfig.transactions,
				isTransferNonNativeMosaicValueHidden: true
			};
			const transferWithCustomMosaic = transactionPageResult.data.find(transaction =>
				transaction.type === 'TRANSFER' && transaction.value.some(mosaic => mosaic.id === 'a.test.test'));

			// Act:
			render(<TransactionList preloadedData={[transferWithCustomMosaic]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('XEM')).toBeInTheDocument();
			expect(screen.queryByText('a.test.test')).not.toBeInTheDocument();
			expect(screen.queryByText('12')).not.toBeInTheDocument();
		});

		it('renders HashLock native mosaic amount and hides non-native mosaic details when configured', () => {
			// Arrange:
			config.NATIVE_MOSAIC_ID = 'nem.xem';
			config.NATIVE_MOSAIC_TICKER = 'XEM';
			pageConfig.transactions = {
				...pageConfig.transactions,
				isTransferNonNativeMosaicValueHidden: true
			};
			const hashLockTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'HASH_LOCK_NATIVE_HASH',
					type: 'HASH_LOCK',
					value: [
						{
							id: 'nem.xem',
							name: 'XEM',
							amount: 10
						}
					]
				},
				{
					...transactionPageResult.data[0],
					hash: 'HASH_LOCK_CUSTOM_HASH',
					type: 'HASH_LOCK',
					value: [
						{
							id: 'custom.mosaic',
							name: 'custom.mosaic',
							amount: 20
						}
					]
				}
			];

			// Act:
			render(<TransactionList preloadedData={hashLockTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('XEM')).toBeInTheDocument();
			expect(screen.getByText('10')).toBeInTheDocument();
			expect(screen.queryByText('custom.mosaic')).not.toBeInTheDocument();
			expect(screen.queryByText('20')).not.toBeInTheDocument();
			const customMosaicImage = screen.getAllByAltText('Mosaic').find(image =>
				image.getAttribute('src') === '/images/icon-mosaic-custom.svg');
			expect(customMosaicImage).toBeInTheDocument();
			expect(customMosaicImage.closest('a')).toHaveAttribute('href', '/mosaics/custom.mosaic');
		});

		it('renders alias transaction action in the value column', () => {
			// Arrange:
			const aliasTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ADDRESS_ALIAS_HASH',
					type: 'ADDRESS_ALIAS',
					aliasAction: 'link',
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'MOSAIC_ALIAS_HASH',
					type: 'MOSAIC_ALIAS',
					aliasAction: 'unlink',
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={aliasTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('value_keyLink')).toBeInTheDocument();
			expect(screen.getByText('value_keyUnlink')).toBeInTheDocument();
		});

		it('renders Mosaic Global Restriction mosaic id in the value column', () => {
			// Arrange:
			const mosaicGlobalRestrictionTransaction = {
				...transactionPageResult.data[0],
				hash: 'MOSAIC_GLOBAL_RESTRICTION_HASH',
				type: 'MOSAIC_GLOBAL_RESTRICTION',
				value: [
					{
						id: '5DE7C2689DEA6B02',
						name: '5DE7C2689DEA6B02',
						amount: null
					}
				]
			};

			// Act:
			render(<TransactionList preloadedData={[mosaicGlobalRestrictionTransaction]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('5DE7C2689DEA6B02')).toBeInTheDocument();
			expect(screen.getByText('5DE7C2689DEA6B02').closest('a')).toHaveAttribute('href', '/mosaics/5DE7C2689DEA6B02');
		});

		it('renders Mosaic Definition mosaic id in the value column', () => {
			// Arrange:
			const mosaicDefinitionTransaction = {
				...transactionPageResult.data[0],
				hash: 'MOSAIC_DEFINITION_HASH',
				type: 'MOSAIC_DEFINITION',
				value: [
					{
						id: '640E1E8507E8C16B',
						name: '640E1E8507E8C16B',
						amount: null
					}
				]
			};

			// Act:
			render(<TransactionList preloadedData={[mosaicDefinitionTransaction]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('640E1E8507E8C16B')).toBeInTheDocument();
			expect(screen.getByText('640E1E8507E8C16B').closest('a')).toHaveAttribute('href', '/mosaics/640E1E8507E8C16B');
		});

		it('renders Mosaic Supply Revocation mosaic id in the value column', () => {
			// Arrange:
			const mosaicSupplyRevocationTransaction = {
				...transactionPageResult.data[0],
				hash: 'MOSAIC_SUPPLY_REVOCATION_HASH',
				type: 'MOSAIC_SUPPLY_REVOCATION',
				value: [
					{
						id: '4E806F3E44AC0FCB',
						name: '4E806F3E44AC0FCB',
						amount: null
					}
				]
			};

			// Act:
			render(<TransactionList preloadedData={[mosaicSupplyRevocationTransaction]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('4E806F3E44AC0FCB')).toBeInTheDocument();
			expect(screen.getByText('4E806F3E44AC0FCB').closest('a')).toHaveAttribute('href', '/mosaics/4E806F3E44AC0FCB');
		});

		it('renders Mosaic Supply Change action in the value column', () => {
			// Arrange:
			const mosaicSupplyChangeTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'MOSAIC_SUPPLY_CHANGE_INCREASE_HASH',
					type: 'MOSAIC_SUPPLY_CHANGE',
					supplyAction: 'increase',
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'MOSAIC_SUPPLY_CHANGE_DECREASE_HASH',
					type: 'MOSAIC_SUPPLY_CHANGE',
					supplyAction: 'decrease',
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={mosaicSupplyChangeTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('value_supplyIncrease')).toBeInTheDocument();
			expect(screen.getByText('value_supplyDecrease')).toBeInTheDocument();
		});

		it('renders Account Mosaic Restriction addition and deletion counts in the value column', () => {
			// Arrange:
			const accountMosaicRestrictionTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_MOSAIC_RESTRICTION_ADDED_HASH',
					type: 'ACCOUNT_MOSAIC_RESTRICTION',
					restrictionAction: {
						added: 1,
						removed: 0
					},
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_MOSAIC_RESTRICTION_REMOVED_HASH',
					type: 'ACCOUNT_MOSAIC_RESTRICTION',
					restrictionAction: {
						added: 0,
						removed: 2
					},
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={accountMosaicRestrictionTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('1 added')).toBeInTheDocument();
			expect(screen.getByText('2 removed')).toBeInTheDocument();
		});

		it('renders Account Address Restriction addition and deletion counts in the value column', () => {
			// Arrange:
			const accountAddressRestrictionTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_ADDRESS_RESTRICTION_ADDED_HASH',
					type: 'ACCOUNT_ADDRESS_RESTRICTION',
					restrictionAction: {
						added: 1,
						removed: 0
					},
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_ADDRESS_RESTRICTION_REMOVED_HASH',
					type: 'ACCOUNT_ADDRESS_RESTRICTION',
					restrictionAction: {
						added: 0,
						removed: 1
					},
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={accountAddressRestrictionTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('1 added')).toBeInTheDocument();
			expect(screen.getByText('1 removed')).toBeInTheDocument();
		});

		it('renders Account Operation Restriction addition and deletion counts in the value column', () => {
			// Arrange:
			const accountOperationRestrictionTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_OPERATION_RESTRICTION_ADDED_HASH',
					type: 'ACCOUNT_OPERATION_RESTRICTION',
					restrictionAction: {
						added: 2,
						removed: 0
					},
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_OPERATION_RESTRICTION_REMOVED_HASH',
					type: 'ACCOUNT_OPERATION_RESTRICTION',
					restrictionAction: {
						added: 0,
						removed: 1
					},
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={accountOperationRestrictionTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('2 added')).toBeInTheDocument();
			expect(screen.getByText('1 removed')).toBeInTheDocument();
		});

		it('renders Secret Proof proof in the value column', () => {
			// Arrange:
			const proof = '636F727265637420686F727365206261747465727920737461706C65';
			const secretProofTransaction = {
				...transactionPageResult.data[0],
				hash: 'SECRET_PROOF_HASH',
				type: 'SECRET_PROOF',
				proof,
				value: []
			};

			// Act:
			render(<TransactionList preloadedData={[secretProofTransaction]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText(proof)).toBeInTheDocument();
		});

		it('renders Secret Lock secret in the value column', () => {
			// Arrange:
			const secret = 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB';
			const secretLockTransaction = {
				...transactionPageResult.data[0],
				hash: 'SECRET_LOCK_HASH',
				type: 'SECRET_LOCK',
				secret,
				value: []
			};

			// Act:
			render(<TransactionList preloadedData={[secretLockTransaction]} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText(secret)).toBeInTheDocument();
		});

		it('renders key link transaction action in the value column', () => {
			// Arrange:
			const keyLinkTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ACCOUNT_KEY_LINK_HASH',
					type: 'ACCOUNT_KEY_LINK',
					linkAction: 'link',
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'NODE_KEY_LINK_HASH',
					type: 'NODE_KEY_LINK',
					linkAction: 'unlink',
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'VOTING_KEY_LINK_HASH',
					type: 'VOTING_KEY_LINK',
					linkAction: 'link',
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'VRF_KEY_LINK_HASH',
					type: 'VRF_KEY_LINK',
					linkAction: 'unlink',
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={keyLinkTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getAllByText('value_keyLink')).toHaveLength(2);
			expect(screen.getAllByText('value_keyUnlink')).toHaveLength(2);
		});

		it('renders namespace registration type and name in the value column', () => {
			// Arrange:
			const namespaceRegistrationTransactions = [
				{
					...transactionPageResult.data[0],
					hash: 'ROOT_NAMESPACE_HASH',
					type: 'NAMESPACE_REGISTRATION',
					namespaceRegistration: {
						id: '88A058DAA0940608',
						name: 'rootnamespace',
						registrationType: 'root'
					},
					value: []
				},
				{
					...transactionPageResult.data[0],
					hash: 'SUB_NAMESPACE_HASH',
					type: 'NAMESPACE_REGISTRATION',
					namespaceRegistration: {
						id: 'A8A057CA90B40609',
						name: 'rootnamespace.subnamespace',
						registrationType: 'sub'
					},
					value: []
				}
			];

			// Act:
			render(<TransactionList preloadedData={namespaceRegistrationTransactions} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText('filter_rootNamespace')).toBeInTheDocument();
			expect(screen.getByText('rootnamespace')).toBeInTheDocument();
			expect(screen.getByText('filter_subNamespace')).toBeInTheDocument();
			expect(screen.getByText('rootnamespace.subnamespace')).toBeInTheDocument();
			expect(screen.getByText('rootnamespace').closest('a')).toHaveAttribute('href', '/namespaces/88A058DAA0940608');
			expect(screen.getByText('rootnamespace.subnamespace').closest('a')).toHaveAttribute(
				'href',
				'/namespaces/A8A057CA90B40609'
			);
		});
	});
});
