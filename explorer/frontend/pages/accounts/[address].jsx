import { fetchAccountInfo } from '@/api/accounts';
import { search } from '@/api/search';
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
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionDirection from '@/components/ValueTransactionDirection';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/pages/AccountInfo.module.scss';
import { formatMosaicCSV, formatTransactionCSV, useClientSideFilter, usePagination, useStorage, useUserCurrencyAmount } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale, params }) => {
	const accountInfo = await fetchAccountInfo(params.address);
	const transactionsPage = await fetchTransactionPage({ address: params.address });

	if (!accountInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			accountInfo,
			preloadedTransactions: transactionsPage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const AccountInfo = ({ accountInfo, preloadedTransactions }) => {
	const { address } = accountInfo;
	const [userCurrency] = useStorage(STORAGE_KEY.USER_CURRENCY, 'USD');
	const [contacts] = useStorage(STORAGE_KEY.ADDRESS_BOOK, []);
	const balanceInUserCurrency = useUserCurrencyAmount(fetchPriceByDate, accountInfo.balance, userCurrency);
	const { t } = useTranslation();
	const transactionPagination = usePagination(fetchTransactionPage, preloadedTransactions, { address });
	const mosaics = useClientSideFilter(accountInfo.mosaics);
	const isMultisigSectionShown = accountInfo.isMultisig || accountInfo.cosignatoryOf.length > 0;

	const mosaicFilterConfig = [
		{
			name: 'isCreatedByAccount',
			title: t('filter_created'),
			type: 'boolean'
		},
		{
			name: 'isExpired',
			title: t('filter_expired'),
			type: 'boolean'
		}
	];

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
	const transactionFilterConfig = [
		{
			name: 'types',
			title: t('filter_type'),
			conflicts: ['mosaic', 'to'],
			type: 'transaction-type',
			options: Object.values(TRANSACTION_TYPE).map(type => ({ type }))
		},
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
		},
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
						<Field title={t('field_vestedBalance')} description={t('field_vestedBalance_description')}>
							{accountInfo.vestedBalance} XEM
						</Field>
					</div>
				</Section>
			</div>
			<Section title={t('section_accountState')} cardClassName={styles.stateSectionCard}>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter data={mosaicFilterConfig} value={mosaics.filter} onChange={mosaics.changeFilter} search={search} />
						<ButtonCSV data={mosaics.data} fileName={`mosaics-${address}`} format={row => formatMosaicCSV(row, t)} />
					</div>
					<div className={styles.stateTable}>
						{mosaics.data.map((item, key) => (
							<ValueMosaic size="md" mosaicId={item.id} mosaicName={item.name} amount={item.amount} key={'ownmos' + key} />
						))}
					</div>
				</div>
			</Section>
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
			<Section title={t('section_transactions')}>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter
							isSelectedItemsShown
							data={transactionFilterConfig}
							isDisabled={transactionPagination.isLoading}
							value={transactionPagination.filter}
							onChange={transactionPagination.changeFilter}
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
