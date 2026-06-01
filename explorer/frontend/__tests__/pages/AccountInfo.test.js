import '@testing-library/jest-dom';
import { accountInfoResult } from '../test-utils/accounts';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountMultisigService from '@/api/accountMultisig';
import * as AccountService from '@/api/accounts';
import * as BlockReceiptService from '@/api/blockReceipts';
import * as HashLockService from '@/api/hashLocks';
import * as SecretLockService from '@/api/secretLocks';
import * as TransactionService from '@/api/transactions';
import AccountInfo, { getServerSideProps } from '@/pages/accounts/[address]';
import * as utils from '@/utils';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

jest.mock('@/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/accounts')
	};
});

jest.mock('@/api/accountMultisig', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/accountMultisig')
	};
});

jest.mock('@/api/blockReceipts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blockReceipts')
	};
});

jest.mock('@/api/hashLocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/hashLocks')
	};
});

jest.mock('@/api/secretLocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/secretLocks')
	};
});

beforeEach(() => {
	jest.spyOn(utils, 'useUserCurrencyAmount').mockReturnValue(1000);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(transactionPageResult);
});

describe('AccountInfo', () => {
	const originalAccountsConfig = { ...pageConfig.accounts };

	afterEach(() => {
		Object.assign(pageConfig.accounts, originalAccountsConfig);
		jest.restoreAllMocks();
	});

	describe('getServerSideProps', () => {
		const runTest = async (accountInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { address: accountInfoResult.address };
			const fetchAccountInfo = jest.spyOn(AccountService, 'fetchAccountInfo');
			fetchAccountInfo.mockResolvedValue(accountInfo);
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchAccountInfo).toHaveBeenCalledWith(params.address);
			expect(fetchTransactionPage).toHaveBeenCalledWith({ address: params.address });
			expect(result).toEqual(expectedResult);
		};

		it('returns account info', async () => {
			// Arrange:
			const accountInfo = accountInfoResult;
			const expectedResult = {
				props: {
					accountInfo,
					accountMultisig: null,
					balanceChangeReceipts: [],
					balanceTransferReceipts: [],
					hashLocks: [],
					harvestedBlocks: [],
					metadataEntries: [],
					mosaicAddressRestrictions: [],
					ownedNamespaces: [],
					preloadedTransactions: transactionPageResult.data,
					secretLocks: []
				}
			};

			// Act + Assert:
			await runTest(accountInfo, expectedResult);
		});

		it('does not prefetch account detail optional sections during SSR', async () => {
			// Arrange:
			pageConfig.accounts.showReceipts = true;
			pageConfig.accounts.showHarvestedBlocks = true;
			pageConfig.accounts.showHashLocks = true;
			pageConfig.accounts.showSecretLocks = true;
			pageConfig.accounts.showMultisigCosignatories = true;
			const locale = 'en';
			const params = { address: accountInfoResult.address };
			const fetchAccountInfo = jest.spyOn(AccountService, 'fetchAccountInfo');
			fetchAccountInfo.mockResolvedValue(accountInfoResult);
			const fetchBlockReceiptPage = jest.spyOn(BlockReceiptService, 'fetchBlockReceiptPage');
			const fetchHashLockPage = jest.spyOn(HashLockService, 'fetchHashLockPage');
			const fetchSecretLockPage = jest.spyOn(SecretLockService, 'fetchSecretLockPage');
			const fetchAccountMultisig = jest.spyOn(AccountMultisigService, 'fetchAccountMultisig');

			// Act:
			await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchBlockReceiptPage).not.toHaveBeenCalled();
			expect(fetchHashLockPage).not.toHaveBeenCalled();
			expect(fetchSecretLockPage).not.toHaveBeenCalled();
			expect(fetchAccountMultisig).not.toHaveBeenCalled();
		});

		it('returns not found', async () => {
			// Arrange:
			const locale = 'en';
			const params = { address: accountInfoResult.address };
			const fetchAccountInfo = jest.spyOn(AccountService, 'fetchAccountInfo');
			fetchAccountInfo.mockResolvedValue(null);
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchAccountInfo).toHaveBeenCalledWith(params.address);
			expect(fetchTransactionPage).not.toHaveBeenCalled();
			expect(result).toEqual({
				notFound: true
			});
		});
	});

	describe('account information', () => {
		it('renders page with the information about the account', () => {
			// Arrange:
			const pageSectionText = 'section_account';
			const addressText = accountInfoResult.address;
			const { balance } = accountInfoResult;
			const descriptionText = accountInfoResult.description;
			const publicKeyText = accountInfoResult.publicKey;
			const heightText = accountInfoResult.height;
			const importanceText = `${accountInfoResult.importance} %`;
			const { mosaics } = accountInfoResult;

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={[]} />);
			const [balanceElement, mosaicElement] = screen.getAllByText(balance);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(addressText)).toBeInTheDocument();
			expect(balanceElement).toBeInTheDocument();
			expect(mosaicElement).toBeInTheDocument();
			expect(screen.getByText(descriptionText)).toBeInTheDocument();
			expect(screen.getByText(publicKeyText)).toBeInTheDocument();
			expect(screen.getByText(heightText)).toBeInTheDocument();
			expect(screen.getByText(importanceText)).toBeInTheDocument();
			mosaics.forEach(mosaic => expect(screen.getByText(mosaic.id)).toBeInTheDocument());
		});

		it('renders page without account description', () => {
			// Arrange:
			const descriptionText = accountInfoResult.description;
			const accountInfoWithoutDescription = { ...accountInfoResult, description: null };
			const noDescriptionText = 'No description';

			// Act:
			render(<AccountInfo accountInfo={accountInfoWithoutDescription} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText(descriptionText)).not.toBeInTheDocument();
			expect(screen.getByText(noDescriptionText)).toBeInTheDocument();
		});

		it('renders address aliases when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = true;
			const accountInfo = {
				...accountInfoResult,
				namespaces: ['alice', 'company.alice']
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('table_field_alias')).toBeInTheDocument();
			expect(screen.getByText('alice')).toBeInTheDocument();
			expect(screen.getByText('company.alice')).toBeInTheDocument();
		});

		it('renders N/A for address aliases when none are linked', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = true;
			pageConfig.accounts.showVotingKeys = false;
			const accountInfo = {
				...accountInfoResult,
				namespaces: []
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('table_field_alias')).toBeInTheDocument();
			expect(screen.getByText('N/A')).toBeInTheDocument();
		});

		it('renders account type and hides vested balance when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showVestedBalance = false;
			pageConfig.accounts.showAccountType = true;
			const accountInfo = {
				...accountInfoResult,
				accountType: 'main'
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText('field_vestedBalance')).not.toBeInTheDocument();
			expect(screen.getByText('field_accountType')).toBeInTheDocument();
			expect(screen.getByText('value_accountType_main')).toBeInTheDocument();
		});

		it('renders owned namespaces when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showOwnedNamespaces = true;
			const ownedNamespaces = [
				{
					name: 'D47D7DC85A201C13',
					namespaceName: 'alice',
					expirationHeight: 12345,
					isUnlimitedDuration: false,
					registrationType: 'root'
				},
				{
					name: 'DA664716F7672DD7',
					namespaceName: 'alice.sub',
					expirationHeight: 23456,
					isUnlimitedDuration: false,
					registrationType: 'sub'
				}
			];

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} ownedNamespaces={ownedNamespaces} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('section_ownedNamespaces')).toBeInTheDocument();
			expect(screen.getByText('alice')).toBeInTheDocument();
			expect(screen.getByText('alice.sub')).toBeInTheDocument();
			expect(screen.getByText('12345')).toBeInTheDocument();
			expect(screen.getByText('23456')).toBeInTheDocument();
			expect(screen.getByText('filter_rootNamespace')).toBeInTheDocument();
			expect(screen.getByText('filter_subNamespace')).toBeInTheDocument();
		});

		it('renders multisig cosignatories below account state when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showMultisigCosignatories = true;
			const accountMultisig = {
				minApproval: 7,
				minRemoval: 3,
				cosignatoryAddresses: [
					'TCOSIGNATORYADDRESS2V7NJ27SYNA7WILGVQ',
					'TCOSIGNATORYADDRESS3V7NJ27SYNA7WILGVQ'
				],
				multisigAddresses: [
					'TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2'
				]
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} accountMultisig={accountMultisig} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('section_accountState').compareDocumentPosition(screen.getByText('section_multisigCosignatories')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_minApproval')).toBeInTheDocument();
			expect(screen.getByText('table_field_minRemoval')).toBeInTheDocument();
			expect(screen.getByText('table_field_cosignatoryAddresses')).toBeInTheDocument();
			expect(screen.getByText('table_field_multisigAddresses')).toBeInTheDocument();
			expect(screen.getByText('7')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument();
			expect(screen.getByText('TCOSIGNATORYADDRESS2V7NJ27SYNA7WILGVQ')).toBeInTheDocument();
			expect(screen.getByText('TCOSIGNATORYADDRESS3V7NJ27SYNA7WILGVQ')).toBeInTheDocument();
			expect(screen.getByText('TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2')).toBeInTheDocument();
		});

		it('does not render empty multisig cosignatory rows', () => {
			// Arrange:
			pageConfig.accounts.showMultisigCosignatories = true;
			const accountMultisig = {
				minApproval: null,
				minRemoval: null,
				cosignatoryAddresses: [],
				multisigAddresses: [
					'TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2'
				]
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} accountMultisig={accountMultisig} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('section_multisigCosignatories')).toBeInTheDocument();
			expect(screen.queryByText('table_field_minApproval')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_minRemoval')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_cosignatoryAddresses')).not.toBeInTheDocument();
			expect(screen.getByText('table_field_multisigAddresses')).toBeInTheDocument();
		});

		it('renders supplemental keys below owned namespaces when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showOwnedNamespaces = true;
			pageConfig.accounts.showSupplementalKeys = true;
			pageConfig.accounts.showVotingKeys = false;
			const ownedNamespaces = [
				{
					name: 'D47D7DC85A201C13',
					namespaceName: 'alice',
					expirationHeight: 12345,
					isUnlimitedDuration: false,
					registrationType: 'root'
				}
			];
			const accountInfo = {
				...accountInfoResult,
				supplementalKeys: {
					linked: 'TLINKED2GMA34VQ75JZDLEA5DR55VBILN4F6A3',
					node: null,
					vrf: null
				}
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} ownedNamespaces={ownedNamespaces} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('section_ownedNamespaces').compareDocumentPosition(screen.getByText('section_supplymentalKeys')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_linked')).toBeInTheDocument();
			expect(screen.getByText('table_field_node')).toBeInTheDocument();
			expect(screen.getByText('table_field_vrf')).toBeInTheDocument();
			expect(screen.getByText('TLINKED2GMA34VQ75JZDLEA5DR55VBILN4F6A3')).toBeInTheDocument();
			expect(screen.getAllByText('N/A')).toHaveLength(2);
		});

		it('renders voting keys below supplemental keys when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showSupplementalKeys = true;
			pageConfig.accounts.showVotingKeys = true;
			const accountInfo = {
				...accountInfoResult,
				supplementalKeys: {
					linked: null,
					node: null,
					vrf: null
				},
				votingKeys: [
					{
						publicKey: 'A'.repeat(64),
						startEpoch: 8,
						endEpoch: 12,
						status: 'current'
					},
					{
						publicKey: 'B'.repeat(64),
						startEpoch: 12,
						endEpoch: 14,
						status: 'future'
					}
				]
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('section_supplymentalKeys').compareDocumentPosition(screen.getByText('section_votingKeys')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_publicKeys')).toBeInTheDocument();
			expect(screen.getByText('table_field_epochInfo')).toBeInTheDocument();
			expect(screen.getByText('A'.repeat(64))).toBeInTheDocument();
			expect(screen.getByText('votingKeyStatus_current : Epoch 8 - Epoch 12')).toBeInTheDocument();
			expect(screen.getByText('B'.repeat(64))).toBeInTheDocument();
			expect(screen.getByText('votingKeyStatus_future : Epoch 12 - Epoch 14')).toBeInTheDocument();
		});
	});

	describe('account transactions', () => {
		it('renders page with the list of transactions', () => {
			// Arrange:
			const pageSectionText = 'section_transactions';
			const transactionHashes = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			transactionHashes.forEach(hash => expect(screen.getByText(hash)).toBeInTheDocument());
		});

		it('hides from and to filters when disabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showTransactionAddressFilters = false;

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

			// Assert:
			expect(screen.getByText('filter_type')).toBeInTheDocument();
			expect(screen.getByText('filter_mosaic')).toBeInTheDocument();
			expect(screen.queryByText('filter_from')).not.toBeInTheDocument();
			expect(screen.queryByText('filter_to')).not.toBeInTheDocument();
		});

		it('renders mosaic address restrictions above transactions when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showMosaicAddressRestrictions = true;
			const mosaicAddressRestrictions = [
				{
					compositeHash: 'ADDRESS_COMPOSITE_HASH',
					entryType: 'Mosaic Address Restriction',
					mosaicId: '6F7904E6DF09D21D',
					targetAddress: accountInfoResult.address,
					restrictions: '790526: 10'
				}
			];
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					mosaicAddressRestrictions={mosaicAddressRestrictions}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			// Act:
			render(accountInfo);

			// Assert:
			expect(screen.getByText('tab_mosaicAddressRestriction').compareDocumentPosition(screen.getByText('section_transactions')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('ADDRESS_COMPOSITE_HASH')).toBeInTheDocument();
			expect(screen.getByText('Mosaic Address Restriction')).toBeInTheDocument();
			expect(screen.getByText('table_field_mosaicId')).toBeInTheDocument();
			expect(screen.getByText('6F7904E6DF09D21D')).toBeInTheDocument();
			expect(screen.queryByText('table_field_targetAddress')).not.toBeInTheDocument();
			expect(screen.getByText('790526: 10')).toBeInTheDocument();
		});

		it('renders metadata entries below mosaic address restrictions', () => {
			// Arrange:
			pageConfig.accounts.showMosaicAddressRestrictions = true;
			pageConfig.accounts.showMetadataEntries = true;
			const metadataEntries = [
				{
					scopedMetadataKey: 'BB3026E7612A769F',
					targetId: null,
					metadataType: 'account',
					senderAddress: 'SENDER_ADDRESS',
					targetAddress: accountInfoResult.address,
					value: 'Account metadata'
				},
				{
					scopedMetadataKey: '0000676E69746172',
					targetId: '6F7904E6DF09D21D',
					metadataType: 'mosaic',
					senderAddress: 'SENDER_ADDRESS',
					targetAddress: accountInfoResult.address,
					value: 'Mosaic metadata'
				}
			];

			// Act:
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					metadataEntries={metadataEntries}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			render(accountInfo);

			// Assert:
			expect(screen.getByText('section_metadataEntries').compareDocumentPosition(screen.getByText('section_transactions')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('filter_latest')).toBeInTheDocument();
			expect(screen.getAllByText('metadataType_account').length).toBeGreaterThan(0);
			expect(screen.getAllByText('metadataType_mosaic').length).toBeGreaterThan(0);
			expect(screen.getByText('metadataType_namespace')).toBeInTheDocument();
			expect(screen.getByText('table_field_scopedMetadataKey')).toBeInTheDocument();
			expect(screen.getByText('table_field_targetId')).toBeInTheDocument();
			expect(screen.getAllByText('table_field_type').length).toBeGreaterThan(0);
			expect(screen.getByText('BB3026E7612A769F')).toBeInTheDocument();
			expect(screen.getByText('N/A')).toBeInTheDocument();
			expect(screen.getByText('6F7904E6DF09D21D')).toBeInTheDocument();
			expect(screen.getByText('Account metadata')).toBeInTheDocument();
			expect(screen.getByText('Mosaic metadata')).toBeInTheDocument();
		});

		it('renders importance history above receipts when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showImportanceHistory = true;
			pageConfig.accounts.showReceipts = true;
			const accountInfo = {
				...accountInfoResult,
				importanceHistory: [
					{
						recalculationBlock: 1000,
						totalFeesPaid: 12345,
						beneficiaryCount: 2,
						importanceScore: 987
					}
				]
			};

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={transactionPageResult.data} />);

			// Assert:
			expect(screen.getByText('section_importanceHistory').compareDocumentPosition(screen.getByText('section_receipts')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_recalculationBlock')).toBeInTheDocument();
			expect(screen.getByText('table_field_totalFeesPaid')).toBeInTheDocument();
			expect(screen.getByText('table_field_beneficiaryCount')).toBeInTheDocument();
			expect(screen.getByText('table_field_importanceScore')).toBeInTheDocument();
			expect(screen.getByText('1000')).toBeInTheDocument();
			expect(screen.getByText('12345')).toBeInTheDocument();
			expect(screen.getByText('2')).toBeInTheDocument();
			expect(screen.getByText('987')).toBeInTheDocument();
		});

		it('renders hash locks below metadata entries when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showMetadataEntries = true;
			pageConfig.accounts.showHashLocks = true;
			const metadataEntries = [
				{
					scopedMetadataKey: 'BB3026E7612A769F',
					targetId: null,
					metadataType: 'account',
					senderAddress: 'SENDER_ADDRESS',
					targetAddress: accountInfoResult.address,
					value: 'Account metadata'
				}
			];
			const hashLocks = [
				{
					transactionHash: 'HASH_LOCK_TRANSACTION',
					endHeight: 12345,
					status: 'used',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				}
			];
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					metadataEntries={metadataEntries}
					hashLocks={hashLocks}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			// Act:
			render(accountInfo);

			// Assert:
			expect(screen.getByText('section_metadataEntries').compareDocumentPosition(screen.getByText('section_hashLock')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_transactionHash')).toBeInTheDocument();
			expect(screen.getByText('table_field_endHeight')).toBeInTheDocument();
			expect(screen.getByText('HASH_LOCK_TRANSACTION')).toBeInTheDocument();
			expect(screen.getByText('12345')).toBeInTheDocument();
			expect(screen.getByText('hashLockStatus_used')).toBeInTheDocument();
			expect(screen.getByText('50')).toBeInTheDocument();
		});

		it('renders secret locks below hash locks when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showHashLocks = true;
			pageConfig.accounts.showSecretLocks = true;
			const hashLocks = [
				{
					transactionHash: 'HASH_LOCK_TRANSACTION',
					endHeight: 12345,
					status: 'used',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				}
			];
			const secretLocks = [
				{
					recipient: accountInfoResult.address,
					secret: 'SECRET_LOCK_HASH',
					endHeight: 23456,
					status: 'unused',
					hashAlgorithm: 'hash160',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 25, isNative: true }]
				}
			];
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					hashLocks={hashLocks}
					secretLocks={secretLocks}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			// Act:
			render(accountInfo);

			// Assert:
			expect(screen.getByText('section_hashLock').compareDocumentPosition(screen.getByText('section_secretLock')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('table_field_recipient')).toBeInTheDocument();
			expect(screen.getByText('table_field_secret')).toBeInTheDocument();
			expect(screen.getByText('table_field_hashAlgorithm')).toBeInTheDocument();
			expect(screen.getByText('SECRET_LOCK_HASH')).toBeInTheDocument();
			expect(screen.getByText('23456')).toBeInTheDocument();
			expect(screen.getByText('hashLockStatus_unused')).toBeInTheDocument();
			expect(screen.getByText('secretLockHashAlgorithm_hash160')).toBeInTheDocument();
			expect(screen.getByText('25')).toBeInTheDocument();
		});

		it('renders harvested blocks above receipts when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showHarvestedBlocks = true;
			pageConfig.accounts.showReceipts = true;
			const harvestedBlocks = [
				{
					version: 1,
					height: 12345,
					type: 'harvestFee',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 103, isNative: true }]
				}
			];
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					harvestedBlocks={harvestedBlocks}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			// Act:
			render(accountInfo);

			// Assert:
			expect(screen.getByText('section_harvestedBlock').compareDocumentPosition(screen.getByText('section_receipts')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('receiptType_harvestFee')).toBeInTheDocument();
			expect(screen.getByText('12345')).toBeInTheDocument();
			expect(screen.getByText('103')).toBeInTheDocument();
		});

		it('renders receipts above transactions when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showReceipts = true;
			const balanceChangeReceipts = [
				{
					version: 1,
					height: 12345,
					type: 'harvestFee',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 12, isNative: true }]
				}
			];
			const balanceTransferReceipts = [
				{
					version: 1,
					height: 12346,
					type: 'mosaicRentalFee',
					to: accountInfoResult.address,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 5, isNative: true }]
				}
			];
			const accountInfo = (
				<AccountInfo
					accountInfo={accountInfoResult}
					balanceChangeReceipts={balanceChangeReceipts}
					balanceTransferReceipts={balanceTransferReceipts}
					preloadedTransactions={transactionPageResult.data}
				/>
			);

			// Act:
			render(accountInfo);

			// Assert:
			expect(screen.getByText('section_receipts').compareDocumentPosition(screen.getByText('section_transactions')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('section_balanceChangeReceipt')).toBeInTheDocument();
			expect(screen.getByText('section_balanceTransferReceipt')).toBeInTheDocument();
			expect(screen.getByText('receiptType_harvestFee')).toBeInTheDocument();
			expect(screen.getByText('12345')).toBeInTheDocument();
		});
	});

	describe('account multisig', () => {
		it('renders page with the information about the multisig account', () => {
			// Arrange:
			const cosignatories = ['NANGHZNOAFIKE5QTGOLWP66I2SPJSYLRXY63EODH', 'NAEF6OBWJLW3CBM7U6QVCDRS4XAKBIC4VWACEGVL'];
			const cosignatoryOf = ['NCYAVMNQOZ3MZETEBD34ACMAX3S57WUSWAZWY3DW'];
			const multisigAccountInfo = {
				...accountInfoResult,
				cosignatories,
				cosignatoryOf,
				isMultisig: true
			};
			const pageSectionText = 'section_multisig';
			const labelMultisigText = 'label_multisig';

			// Act:
			render(<AccountInfo accountInfo={multisigAccountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(labelMultisigText)).toBeInTheDocument();
			cosignatories.map(address => expect(screen.getByText(address)).toBeInTheDocument());
			cosignatoryOf.map(address => expect(screen.getByText(address)).toBeInTheDocument());
		});

		it('renders page with the information about non-multisig account', () => {
			// Arrange:
			const accountInfo = {
				...accountInfoResult,
				cosignatories: [],
				cosignatoryOf: [],
				isMultisig: false
			};
			const pageSectionText = 'section_multisig';
			const labelMultisigText = 'label_multisig';

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText(pageSectionText)).not.toBeInTheDocument();
			expect(screen.queryByText(labelMultisigText)).not.toBeInTheDocument();
		});
	});
});
