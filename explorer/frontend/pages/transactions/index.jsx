import { search } from '@/api/search';
import { fetchTransactionChart, fetchStats } from '@/api/stats';
import { fetchTransactionPage } from '@/api/transactions';
import ButtonCSV from '@/components/ButtonCSV';
import ChartColumns from '@/components/ChartColumns';
import Field from '@/components/Field';
import Filter from '@/components/Filter';
import ItemTransactionMobile from '@/components/ItemTransactionMobile';
import Section from '@/components/Section';
import SectionHeaderTransaction from '@/components/SectionHeaderTransaction';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueList from '@/components/ValueList';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/pages/TransactionList.module.scss';
import { formatDate, formatTransactionCSV, useFilter, usePagination, useStorage } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const transactionsPage = await fetchTransactionPage();
	const stats = await fetchStats();

	return {
		props: {
			preloadedData: transactionsPage.data,
			stats: stats.transactions,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const TransactionInfo = ({ preloadedData, stats }) => {
	const { t } = useTranslation();
	const [contacts] = useStorage(STORAGE_KEY.ADDRESS_BOOK, []);
	const { requestNextPage, data, isLoading, isLastPage, filter, changeFilter } = usePagination(fetchTransactionPage, preloadedData);
	const chart = useFilter(fetchTransactionChart, [], true);
	const formattedChartData = chart.data.map(item => {
		if (chart.filter.isPerDay) {
			return [formatDate(item[0], t), item[1]];
		}
		if (chart.filter.isPerMonth) {
			return [formatDate(item[0], t, { hasDays: false }), item[1]];
		}
		return [t('chart_label_block', { height: item[0] }), item[1]];
	});

	const tableColumns = [
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
			key: 'sender',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'recipient',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'value',
			size: '20rem',
			renderValue: value => (
				<ValueList
					data={value}
					max={2}
					direction="column"
					renderItem={item => <ValueMosaic mosaicId={item.id} mosaicName={item.name} amount={item.amount} isTickerShown />}
				/>
			)
		},
		{
			key: 'fee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative hasTime />
		}
	];

	const transactionFilterConfig = [
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
			conflicts: ['from'],
			isSearchEnabled: true,
			options: contacts
		},
		{
			name: 'mosaic',
			title: t('filter_mosaic'),
			type: 'mosaic',
			conflicts: ['type'],
			isSearchEnabled: true
		},
		{
			name: 'type',
			title: t('filter_type'),
			conflicts: ['mosaic'],
			type: 'transaction-type',
			options: Object.values(TRANSACTION_TYPE)
		}
	];

	const chartFilterConfig = [
		{
			name: 'type',
			title: t('filter_type'),
			type: 'transaction-type',
			options: Object.values(TRANSACTION_TYPE)
		},
		{
			name: 'isPerDay',
			title: t('filter_perDay'),
			off: ['isPerMonth'],
			type: 'boolean'
		},
		{
			name: 'isPerMonth',
			title: t('filter_perMonth'),
			off: ['isPerDay'],
			type: 'boolean'
		}
	];

	const transactionsGrouped = [];
	data.forEach(transaction => {
		const lastGroupIndex = transactionsGrouped.length - 1;
		const { height, timestamp } = transaction;

		if (transactionsGrouped[lastGroupIndex]?.height === height) {
			transactionsGrouped[lastGroupIndex].data.push(transaction);
		} else {
			transactionsGrouped[lastGroupIndex + 1] = {
				height,
				timestamp,
				data: [transaction]
			};
		}
	});

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_transactions')}</title>
			</Head>
			<Section title={t('section_transactions')}>
				<div className="layout-flex-row-mobile-col">
					<div className={`layout-flex-col layout-flex-fill ${styles.statsSection}`}>
						<Field title={t('field_transactionsAll')}>{stats.totalAll}</Field>
						<Field title={t('field_transactions30Days')}>{stats.total30Days}</Field>
						<Field title={t('field_transactions24Hours')}>{stats.total24Hours}</Field>
						<Field title={t('field_transactionsPerBlockShort')} description={t('field_transactionsPerBlock_description')}>
							{stats.averagePerBlock}
						</Field>
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-col layout-flex-fill">
						<Filter
							data={chartFilterConfig}
							isDisabled={chart.isLoading}
							value={chart.filter}
							onChange={chart.changeFilter}
							search={search}
						/>
						<ChartColumns data={formattedChartData} name={t('field_transactions')} />
					</div>
				</div>
			</Section>
			<Section>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter
							data={transactionFilterConfig}
							isDisabled={isLoading}
							value={filter}
							onChange={changeFilter}
							search={search}
						/>
						<ButtonCSV data={data} fileName="transactions" format={row => formatTransactionCSV(row, t)} />
					</div>
					<Table
						sections={transactionsGrouped}
						columns={tableColumns}
						renderItemMobile={data => <ItemTransactionMobile data={data} />}
						isLoading={isLoading}
						isLastPage={isLastPage}
						onEndReached={requestNextPage}
						renderSectionHeader={SectionHeaderTransaction}
					/>
				</div>
			</Section>
		</div>
	);
};

export default TransactionInfo;
