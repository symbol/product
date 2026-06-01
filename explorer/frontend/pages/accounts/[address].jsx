import { fetchAccountMetadataPage } from '@/api/accountMetadata';
import { fetchAccountMultisig } from '@/api/accountMultisig';
import { fetchAccountInfo } from '@/api/accounts';
import { fetchBlockReceiptPage } from '@/api/blockReceipts';
import { fetchChainHight } from '@/api/blocks';
import { fetchHashLockPage } from '@/api/hashLocks';
import { fetchMosaicRestrictionPage } from '@/api/mosaicRestrictions';
import { fetchNamespacePage } from '@/api/namespaces';
import { search } from '@/api/search';
import { fetchSecretLockPage } from '@/api/secretLocks';
import { fetchPriceByDate } from '@/api/stats';
import { fetchTransactionPage } from '@/api/transactions';
import AccountMultisigTree from '@/components/AccountMultisigTree';
import Avatar from '@/components/Avatar';
import ButtonCSV from '@/components/ButtonCSV';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import Filter from '@/components/Filter';
import ItemTransactionMobile from '@/components/ItemTransactionMobile';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueAccountBalance from '@/components/ValueAccountBalance';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueList from '@/components/ValueList';
import ValueMosaic from '@/components/ValueMosaic';
import ValueMosaicAliases from '@/components/ValueMosaicAliases';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionDirection from '@/components/ValueTransactionDirection';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/pages/AccountInfo.module.scss';
import {
	createExpirationLabel,
	createPageHref,
	formatMosaicCSV,
	formatTransactionCSV,
	nullableValueToText,
	useAsyncCall,
	useClientSideFilter,
	usePagination,
	useStorage,
	useUserCurrencyAmount
} from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const MOSAIC_ADDRESS_RESTRICTION_TYPE = 0;
const HARVEST_FEE_RECEIPT_TYPE = 8515;
const ACCOUNT_BALANCE_CHANGE_RECEIPT_TYPES = [12616, 8776, 9032, 12626, 8786, 9042];
const receiptGroups = {
	balanceChange: 'balanceChange',
	balanceTransfer: 'balanceTransfer'
};

const createMosaicList = value => (
	<ValueList
		data={value}
		direction="column"
		renderItem={mosaic => (
			<ValueMosaic
				mosaicId={mosaic.id}
				mosaicName={mosaic.name}
				amount={mosaic.amount}
				isNative={mosaic.isNative}
				isTickerShown
			/>
		)}
	/>
);

const isValuePresent = value => value !== null && value !== undefined;

export const getServerSideProps = async ({ locale, params }) => {
	const accountInfo = await fetchAccountInfo(params.address);

	if (!accountInfo) {
		return {
			notFound: true
		};
	}

	const [
		transactionsPage,
		translations
	] = await Promise.all([
		fetchTransactionPage({ address: params.address }),
		serverSideTranslations(locale, ['common'])
	]);

	return {
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
			preloadedTransactions: transactionsPage.data,
			secretLocks: [],
			...translations
		}
	};
};

const AccountInfo = ({
	accountInfo,
	accountMultisig = null,
	balanceChangeReceipts = [],
	balanceTransferReceipts = [],
	hashLocks = [],
	harvestedBlocks = [],
	metadataEntries = [],
	mosaicAddressRestrictions = [],
	ownedNamespaces = [],
	preloadedTransactions,
	secretLocks = []
}) => {
	const { address } = accountInfo;
	const [userCurrency] = useStorage(STORAGE_KEY.USER_CURRENCY, 'USD');
	const [contacts] = useStorage(STORAGE_KEY.ADDRESS_BOOK, []);
	const balanceInUserCurrency = useUserCurrencyAmount(fetchPriceByDate, accountInfo.balance, userCurrency);
	const { t } = useTranslation();
	const chainHeight = useAsyncCall(pageConfig.accounts.showOwnedNamespaces ? fetchChainHight : async () => 0, 0);
	const accountMultisigData = useAsyncCall(
		pageConfig.accounts.showMultisigCosignatories ? () => fetchAccountMultisig(address) : async () => null,
		accountMultisig
	);
	const transactionPagination = usePagination(fetchTransactionPage, preloadedTransactions, { address });
	const ownedNamespacesPagination = usePagination(fetchNamespacePage, ownedNamespaces, { ownerAddress: address });
	const addressRestrictionPagination = usePagination(fetchMosaicRestrictionPage, mosaicAddressRestrictions, {
		targetAddress: address,
		type: MOSAIC_ADDRESS_RESTRICTION_TYPE
	});
	const metadataPagination = usePagination(fetchAccountMetadataPage, metadataEntries, { targetAddress: address });
	const hashLockPagination = usePagination(fetchHashLockPage, hashLocks, { address });
	const secretLockPagination = usePagination(fetchSecretLockPage, secretLocks, { address });
	const balanceChangeReceiptPagination = usePagination(fetchBlockReceiptPage, balanceChangeReceipts, {
		targetAddress: address,
		group: receiptGroups.balanceChange,
		includedReceiptTypes: ACCOUNT_BALANCE_CHANGE_RECEIPT_TYPES
	});
	const balanceTransferReceiptPagination = usePagination(fetchBlockReceiptPage, balanceTransferReceipts, {
		senderAddress: address,
		group: receiptGroups.balanceTransfer
	});
	const harvestedBlockPagination = usePagination(fetchBlockReceiptPage, harvestedBlocks, {
		targetAddress: address,
		receiptType: HARVEST_FEE_RECEIPT_TYPE,
		group: receiptGroups.balanceChange
	});
	const mosaics = useClientSideFilter(accountInfo.mosaics);
	const isMultisigSectionShown = accountInfo.isMultisig || accountInfo.cosignatoryOf.length > 0;
	const transactionTypeFilterOptions = (pageConfig.transactions?.typeFilterOptions || Object.values(TRANSACTION_TYPE))
		.map(option => typeof option === 'string' ? { type: option } : option);

	const mosaicFilterConfig = [
		{
			name: 'isCreatedByAccount',
			title: t('filter_created'),
			type: 'boolean'
		}
	];
	const renderAddressList = (addresses, title) => (
		<ValueList
			data={addresses}
			direction="column"
			title={title}
			renderItem={address => <ValueAccount address={address} size="sm" />}
		/>
	);

	const transactionTableColumns = [
		{
			key: 'hash',
			size: '8rem',
			renderValue: value => <ValueTransactionHash value={value} />
		},
		{
			key: 'type',
			size: '10rem',
			renderValue: value => <ValueTransactionType value={value} />
		},
		{
			key: 'direction',
			size: '7rem',
			renderValue: value => <ValueTransactionDirection value={value} />
		},
		{
			key: 'account',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'value',
			size: '20rem',
			renderValue: (value, row) => (
				<ValueList
					data={value}
					max={2}
					direction="column"
					renderItem={item => (
						<ValueMosaic
							mosaicId={item.id}
							mosaicName={item.name}
							amount={item.amount}
							isTickerShown
							direction={row.direction}
						/>
					)}
				/>
			)
		},
		{
			key: 'fee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'timestamp',
			size: '10rem',
			renderTitle: () => <FieldTimestamp />,
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
	];
	const ownedNamespacesTableColumns = [
		{
			key: 'name',
			size: '20rem',
			renderTitle: () => t('table_field_name'),
			renderValue: (value, row) => {
				const name = row.namespaceName || value;

				return <Link href={createPageHref('namespaces', name)}>{name}</Link>;
			}
		},
		{
			key: 'status',
			size: '8rem',
			renderValue: (value, row) => {
				const { status, text } = createExpirationLabel(row.expirationHeight, chainHeight, row.isUnlimitedDuration, t);

				return <ValueLabel type={status} text={text} />;
			}
		},
		{
			key: 'expirationHeight',
			size: '10rem',
			renderTitle: () => t('table_field_expirationHeight'),
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'registrationType',
			size: '10rem',
			renderTitle: () => t('table_field_registrationType'),
			renderValue: value => t(`filter_${value}Namespace`)
		}
	];
	const addressRestrictionTableColumns = [
		{
			key: 'compositeHash',
			size: '30rem',
			renderValue: value => <ValueCopy value={value} />
		},
		{
			key: 'entryType',
			size: '18rem',
			renderTitle: () => t('table_field_entryType')
		},
		{
			key: 'mosaicId',
			size: '28rem',
			renderTitle: () => t('table_field_mosaicId'),
			renderValue: value => <Link href={createPageHref('mosaics', value)}>{value}</Link>
		},
		{
			key: 'restrictions',
			size: '22rem',
			renderTitle: () => t('table_field_restrictionsAllowIf')
		}
	];
	const metadataTableColumns = [
		{
			key: 'scopedMetadataKey',
			size: '18rem',
			renderTitle: () => t('table_field_scopedMetadataKey'),
			renderValue: value => <span>{nullableValueToText(value)}</span>
		},
		{
			key: 'targetId',
			size: '18rem',
			renderTitle: () => t('table_field_targetId'),
			renderValue: (value, row) => row.metadataType === 'account' ? 'N/A' : nullableValueToText(value)
		},
		{
			key: 'metadataType',
			size: '10rem',
			renderTitle: () => t('table_field_type'),
			renderValue: value => t(`metadataType_${value}`)
		},
		{
			key: 'senderAddress',
			size: '24rem',
			renderTitle: () => t('table_field_senderAddress'),
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'targetAddress',
			size: '24rem',
			renderTitle: () => t('table_field_targetAddress'),
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'value',
			size: '24rem',
			renderTitle: () => t('table_field_value'),
			renderValue: value => <span>{nullableValueToText(value)}</span>
		}
	];
	const metadataFilterConfig = [
		{
			name: 'isLatest',
			title: t('filter_latest'),
			type: 'boolean',
			off: ['isAccount', 'isMosaic', 'isNamespace']
		},
		{
			name: 'isAccount',
			title: t('metadataType_account'),
			type: 'boolean',
			off: ['isLatest', 'isMosaic', 'isNamespace']
		},
		{
			name: 'isMosaic',
			title: t('metadataType_mosaic'),
			type: 'boolean',
			off: ['isLatest', 'isAccount', 'isNamespace']
		},
		{
			name: 'isNamespace',
			title: t('metadataType_namespace'),
			type: 'boolean',
			off: ['isLatest', 'isAccount', 'isMosaic']
		}
	];
	const balanceChangeReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'height', size: '8rem', renderValue: value => <ValueBlockHeight value={value} /> },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'mosaics', size: '20rem', renderValue: createMosaicList }
	];
	const balanceTransferReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'height', size: '8rem', renderValue: value => <ValueBlockHeight value={value} /> },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'to', size: '24rem', renderValue: value => <ValueAccount address={value} size="sm" /> },
		{ key: 'mosaics', size: '20rem', renderValue: createMosaicList }
	];
	const createReceiptTable = (pagination, columns) => (
		<div className={styles.receiptTable}>
			<Table
				data={pagination.data}
				columns={columns}
				isLoading={pagination.isLoading}
				isLastPage={pagination.isLastPage}
				isError={pagination.isError}
				isHeaderSticky={false}
				onEndReached={pagination.requestNextPage}
			/>
		</div>
	);
	const receiptTabs = [
		{
			label: t('section_balanceChangeReceipt'),
			content: createReceiptTable(balanceChangeReceiptPagination, balanceChangeReceiptColumns)
		},
		{
			label: t('section_balanceTransferReceipt'),
			content: createReceiptTable(balanceTransferReceiptPagination, balanceTransferReceiptColumns)
		}
	];
	const renderSupplementalKey = value => value ? <ValueAccount address={value} size="sm" /> : 'N/A';
	const votingKeyTableColumns = [
		{
			key: 'publicKey',
			size: '32rem',
			renderTitle: () => t('table_field_publicKeys'),
			renderValue: value => value ? <ValueCopy value={value} /> : 'N/A'
		},
		{
			key: 'epochInfo',
			size: '20rem',
			renderTitle: () => t('table_field_epochInfo'),
			renderValue: (_, row) => row.publicKey
				? `${t(`votingKeyStatus_${row.status}`)} : Epoch ${row.startEpoch} - Epoch ${row.endEpoch}`
				: 'N/A'
		}
	];
	const votingKeyTableData = accountInfo.votingKeys?.length
		? accountInfo.votingKeys
		: [{ publicKey: null, startEpoch: null, endEpoch: null, status: null }];
	const importanceHistoryTableColumns = [
		{
			key: 'recalculationBlock',
			size: '12rem',
			renderTitle: () => t('table_field_recalculationBlock'),
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'totalFeesPaid',
			size: '12rem',
			renderTitle: () => t('table_field_totalFeesPaid')
		},
		{
			key: 'beneficiaryCount',
			size: '12rem',
			renderTitle: () => t('table_field_beneficiaryCount')
		},
		{
			key: 'importanceScore',
			size: '12rem',
			renderTitle: () => t('table_field_importanceScore')
		}
	];
	const harvestedBlockColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'height', size: '8rem', renderValue: value => <ValueBlockHeight value={value} /> },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'mosaics', size: '20rem', renderValue: createMosaicList }
	];
	const hashLockColumns = [
		{
			key: 'transactionHash',
			size: '18rem',
			renderTitle: () => t('table_field_transactionHash'),
			renderValue: value => <ValueCopy value={value} />
		},
		{
			key: 'endHeight',
			size: '8rem',
			renderTitle: () => t('table_field_endHeight'),
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'status',
			size: '8rem',
			renderValue: value => value ? t(`hashLockStatus_${value}`) : 'N/A'
		},
		{
			key: 'mosaics',
			size: '20rem',
			renderValue: createMosaicList
		}
	];
	const secretLockColumns = [
		{
			key: 'recipient',
			size: '24rem',
			renderTitle: () => t('table_field_recipient'),
			renderValue: value => value ? <ValueAccount address={value} size="sm" /> : 'N/A'
		},
		{
			key: 'secret',
			size: '18rem',
			renderTitle: () => t('table_field_secret'),
			renderValue: value => <ValueCopy value={value} />
		},
		{
			key: 'endHeight',
			size: '8rem',
			renderTitle: () => t('table_field_endHeight'),
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'status',
			size: '8rem',
			renderValue: value => value ? t(`hashLockStatus_${value}`) : 'N/A'
		},
		{
			key: 'hashAlgorithm',
			size: '10rem',
			renderTitle: () => t('table_field_hashAlgorithm'),
			renderValue: value => value ? t(`secretLockHashAlgorithm_${value}`) : 'N/A'
		},
		{
			key: 'mosaics',
			size: '20rem',
			renderValue: createMosaicList
		}
	];
	const transactionFilterConfig = [
		{
			name: 'types',
			title: t('filter_type'),
			conflicts: ['mosaic', 'to'],
			type: 'transaction-type',
			options: transactionTypeFilterOptions
		},
		...(pageConfig.accounts.showTransactionAddressFilters ? [
			{
				name: 'from',
				title: t('filter_from'),
				type: 'account',
				conflicts: ['to'],
				isSearchEnabled: true,
				options: contacts
			},
			{
				name: 'to',
				title: t('filter_to'),
				type: 'account',
				conflicts: ['types', 'from'],
				isSearchEnabled: true,
				options: contacts
			}
		] : []),
		{
			name: 'mosaic',
			title: t('filter_mosaic'),
			type: 'mosaic',
			conflicts: ['types'],
			isSearchEnabled: true,
			options: accountInfo.mosaics
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_accountInfo', { address: accountInfo.address })}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_account')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<div className="layout-flex-row">
							<Avatar type="account" value={accountInfo.address} size="xl" />
							<div className="layout-flex-row-stacked">
								{accountInfo.isHarvestingActive && <ValueLabel type="harvesting" text={t('label_harvesting')} />}
								{accountInfo.isMultisig && <ValueLabel type="multisig" text={t('label_multisig')} />}
							</div>
						</div>
						<Field title={t('field_balance')}>
							<ValueAccountBalance
								value={accountInfo.balance}
								valueInUserCurrency={balanceInUserCurrency}
								userCurrency={userCurrency}
							/>
						</Field>
						<Field title={t('field_address')}>
							<ValueCopy value={accountInfo.address} />
						</Field>
						{pageConfig.accounts.showNamespace && (
							<Field title={t('table_field_alias')}>
								<ValueMosaicAliases aliases={accountInfo.namespaces} />
							</Field>
						)}
						<div className="value-description">{accountInfo.description || 'No description'}</div>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_publicKey')} description={t('field_publicKey_description')}>
							<ValueCopy value={accountInfo.publicKey} />
						</Field>
						<Field title={t('field_height')} description={t('field_account_height_description')}>
							<ValueBlockHeight value={accountInfo.height} />
						</Field>
						<Field title={t('field_importance')} description={t('field_importance_description')}>
							{accountInfo.importance} %
						</Field>
						{pageConfig.accounts.showVestedBalance && (
							<Field title={t('field_vestedBalance')} description={t('field_vestedBalance_description')}>
								<ValueMosaic isNative amount={accountInfo.vestedBalance} />
							</Field>
						)}
						{pageConfig.accounts.showAccountType && (
							<Field title={t('field_accountType')}>
								{accountInfo.accountType ? t(`value_accountType_${accountInfo.accountType}`) : 'N/A'}
							</Field>
						)}
					</div>
				</Section>
			</div>
			<Section title={t('section_accountState')} cardClassName={styles.stateSectionCard}>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter
							data={mosaicFilterConfig}
							value={mosaics.filter}
							onChange={mosaics.changeFilter}
							search={search}
						/>
						<ButtonCSV data={mosaics.data} fileName={`mosaics-${address}`} format={row => formatMosaicCSV(row, t)} />
					</div>
					<div className={styles.stateTable}>
						{mosaics.data.map((item, key) => (
							<ValueMosaic size="md" mosaicId={item.id} mosaicName={item.name} amount={item.amount} key={'ownmos' + key} />
						))}
					</div>
				</div>
			</Section>
			{pageConfig.accounts.showMultisigCosignatories && accountMultisigData && (
				<Section title={t('section_multisigCosignatories')}>
					<div className="layout-flex-col-fields">
						{isValuePresent(accountMultisigData.minApproval) && (
							<Field title={t('table_field_minApproval')}>
								{accountMultisigData.minApproval}
							</Field>
						)}
						{isValuePresent(accountMultisigData.minRemoval) && (
							<Field title={t('table_field_minRemoval')}>
								{accountMultisigData.minRemoval}
							</Field>
						)}
						{!!accountMultisigData.cosignatoryAddresses?.length && (
							<Field title={t('table_field_cosignatoryAddresses')}>
								{renderAddressList(accountMultisigData.cosignatoryAddresses, t('table_field_cosignatoryAddresses'))}
							</Field>
						)}
						{!!accountMultisigData.multisigAddresses?.length && (
							<Field title={t('table_field_multisigAddresses')}>
								{renderAddressList(accountMultisigData.multisigAddresses, t('table_field_multisigAddresses'))}
							</Field>
						)}
					</div>
				</Section>
			)}
			{pageConfig.accounts.showOwnedNamespaces && (
				<Section title={t('section_ownedNamespaces')} cardClassName={styles.ownedNamespacesSectionCard}>
					<div className={styles.ownedNamespacesTable}>
						<Table
							data={ownedNamespacesPagination.data}
							columns={ownedNamespacesTableColumns}
							isLoading={ownedNamespacesPagination.isLoading}
							isLastPage={ownedNamespacesPagination.isLastPage}
							isError={ownedNamespacesPagination.isError}
							onEndReached={ownedNamespacesPagination.requestNextPage}
							isHeaderSticky={false}
						/>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showSupplementalKeys && (
				<Section title={t('section_supplymentalKeys')}>
					<div className="layout-flex-col-fields">
						<Field title={t('table_field_linked')}>
							{renderSupplementalKey(accountInfo.supplementalKeys?.linked)}
						</Field>
						<Field title={t('table_field_node')}>
							{renderSupplementalKey(accountInfo.supplementalKeys?.node)}
						</Field>
						<Field title={t('table_field_vrf')}>
							{renderSupplementalKey(accountInfo.supplementalKeys?.vrf)}
						</Field>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showVotingKeys && (
				<Section title={t('section_votingKeys')}>
					<Table
						data={votingKeyTableData}
						columns={votingKeyTableColumns}
						isLastPage
						isHeaderSticky={false}
					/>
				</Section>
			)}
			{isMultisigSectionShown && (
				<Section title={t('section_multisig')}>
					<div className="layout-flex-row-mobile-col">
						<div className="layout-flex-col-fields layout-flex-fill">
							{accountInfo.isMultisig && (
								<Field title={t('field_minCosignatories')} description={t('field_minCosignatories_description')}>
									{accountInfo.minCosignatories}
								</Field>
							)}
							{accountInfo.isMultisig && (
								<Field title={t('field_accountCosignatories')} description={t('field_accountCosignatories_description')}>
									<ValueList
										data={accountInfo.cosignatories}
										max={3}
										direction="column"
										title={t('field_accountCosignatories')}
										renderItem={item => <ValueAccount address={item} size="sm" />}
									/>
								</Field>
							)}
							{accountInfo.cosignatoryOf.length > 0 && (
								<Field title={t('field_cosignatoryOf')} description={t('field_cosignatoryOf_description')}>
									<ValueList
										data={accountInfo.cosignatoryOf}
										max={3}
										direction="column"
										title={t('field_cosignatoryOf')}
										renderItem={item => <ValueAccount address={item} size="sm" />}
									/>
								</Field>
							)}
						</div>
						<Separator />
						<div className="layout-flex-fill overflow-x-auto">
							<AccountMultisigTree
								address={accountInfo.address}
								cosignatories={accountInfo.cosignatories}
								cosignatoryOf={accountInfo.cosignatoryOf}
							/>
						</div>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showMosaicAddressRestrictions && (
				<Section title={t('tab_mosaicAddressRestriction')}>
					<Table
						data={addressRestrictionPagination.data}
						columns={addressRestrictionTableColumns}
						isLoading={addressRestrictionPagination.isLoading}
						isLastPage={addressRestrictionPagination.isLastPage}
						isError={addressRestrictionPagination.isError}
						isHeaderSticky={false}
						onEndReached={addressRestrictionPagination.requestNextPage}
					/>
				</Section>
			)}
			{pageConfig.accounts.showMetadataEntries && (
				<Section title={t('section_metadataEntries')} cardClassName={styles.metadataEntriesSectionCard}>
					<div className="layout-flex-col">
						<Filter
							data={metadataFilterConfig}
							isDisabled={metadataPagination.isLoading}
							value={metadataPagination.filter}
							onChange={metadataPagination.changeFilter}
							onClear={metadataPagination.clearFilter}
						/>
						<div className={styles.metadataEntriesTable}>
							<Table
								data={metadataPagination.data}
								columns={metadataTableColumns}
								isLoading={metadataPagination.isLoading}
								isLastPage={metadataPagination.isLastPage}
								isError={metadataPagination.isError}
								isHeaderSticky={false}
								onEndReached={metadataPagination.requestNextPage}
							/>
						</div>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showHashLocks && (
				<Section title={t('section_hashLock')} cardClassName={styles.hashLockSectionCard}>
					<div className={styles.hashLockTable}>
						<Table
							data={hashLockPagination.data}
							columns={hashLockColumns}
							isLoading={hashLockPagination.isLoading}
							isLastPage={hashLockPagination.isLastPage}
							isError={hashLockPagination.isError}
							isHeaderSticky={false}
							onEndReached={hashLockPagination.requestNextPage}
						/>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showSecretLocks && (
				<Section title={t('section_secretLock')} cardClassName={styles.secretLockSectionCard}>
					<div className={styles.secretLockTable}>
						<Table
							data={secretLockPagination.data}
							columns={secretLockColumns}
							isLoading={secretLockPagination.isLoading}
							isLastPage={secretLockPagination.isLastPage}
							isError={secretLockPagination.isError}
							isHeaderSticky={false}
							onEndReached={secretLockPagination.requestNextPage}
						/>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showImportanceHistory && (
				<Section title={t('section_importanceHistory')}>
					<Table
						data={accountInfo.importanceHistory || []}
						columns={importanceHistoryTableColumns}
						isLastPage
						isHeaderSticky={false}
					/>
				</Section>
			)}
			{pageConfig.accounts.showHarvestedBlocks && (
				<Section title={t('section_harvestedBlock')} cardClassName={styles.harvestedBlockSectionCard}>
					<div className={styles.harvestedBlockTable}>
						<Table
							data={harvestedBlockPagination.data}
							columns={harvestedBlockColumns}
							isLoading={harvestedBlockPagination.isLoading}
							isLastPage={harvestedBlockPagination.isLastPage}
							isError={harvestedBlockPagination.isError}
							isHeaderSticky={false}
							onEndReached={harvestedBlockPagination.requestNextPage}
						/>
					</div>
				</Section>
			)}
			{pageConfig.accounts.showReceipts && (
				<Section title={t('section_receipts')} tabs={receiptTabs} cardClassName={styles.receiptSectionCard} />
			)}
			<Section title={t('section_transactions')}>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter
							isSelectedItemsShown
							data={transactionFilterConfig}
							isDisabled={transactionPagination.isLoading}
							value={transactionPagination.filter}
							onChange={transactionPagination.changeFilter}
							onClear={transactionPagination.clearFilter}
							search={search}
						/>
						<ButtonCSV data={transactionPagination.data} fileName={`transactions-${address}`} format={formatTransactionCSV} />
					</div>
					<Table
						data={transactionPagination.data}
						columns={transactionTableColumns}
						renderItemMobile={data => <ItemTransactionMobile data={data} isTimestampShown />}
						isLoading={transactionPagination.isLoading}
						isLastPage={transactionPagination.isLastPage}
						onEndReached={transactionPagination.requestNextPage}
						isLastColumnAligned={true}
					/>
				</div>
			</Section>
		</div>
	);
};

export default AccountInfo;
