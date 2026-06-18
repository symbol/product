import { fetchBlockPage } from '@/app/api/blocks';
import { fetchBlockStats, fetchMarketData, fetchNodeStats, fetchTransactionChart, fetchTransactionStats } from '@/app/api/stats';
import { fetchTransactionPage } from '@/app/api/transactions';
import { AdditionalSections } from '@/app/components/AdditionalSections';
import ChartLine from '@/app/components/ChartLine';
import CustomImage from '@/app/components/CustomImage';
import Field from '@/app/components/Field';
import RecentBlocks from '@/app/components/RecentBlocks';
import RecentTransactions from '@/app/components/RecentTransactions';
import Section from '@/app/components/Section';
import Separator from '@/app/components/Separator';
import ValuePrice from '@/app/components/ValuePrice';
import config from '@/app/config';
import { TRANSACTION_CHART_TYPE } from '@/app/constants';
import styles from '@/app/styles/pages/Home.module.scss';
import { numberToShortString, truncateDecimals, useAsyncCall } from '@/app/utils';
import { formatTransactionChart, numberToString } from '@/app/utils/common';
import { pageConfig } from '@/app/variants/page-config';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useCallback } from 'react';

const DATA_REFRESH_INTERVAL = 60000;

export const getServerSideProps = async ({ locale }) => {
	const [blocksPage, latestTransactionsPage, pendingTransactionsPage] = await Promise.all([
		fetchBlockPage({ pageSize: 50 }),
		fetchTransactionPage({ pageSize: 5 }),
		fetchTransactionPage({ pageSize: 5, group: 'unconfirmed' })
	]);
	const [marketDataPromise, transactionStatsPromise, nodeStatsPromise, transactionChartPromise, blockStatsPromise] =
		await Promise.allSettled([
			fetchMarketData(),
			fetchTransactionStats(),
			fetchNodeStats(),
			fetchTransactionChart({ isPerDay: true }),
			fetchBlockStats()
		]);

	return {
		props: {
			preloadedBlocks: blocksPage,
			preloadedLatestTransactions: latestTransactionsPage,
			preloadedPendingTransactions: pendingTransactionsPage,
			marketData: marketDataPromise.value || {},
			transactionStats: transactionStatsPromise.value || {},
			nodeStats: nodeStatsPromise.value || {},
			transactionChart: transactionChartPromise.value || [],
			blockTime: blockStatsPromise.value?.blockTime || 0,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Home = ({
	preloadedBlocks,
	preloadedLatestTransactions,
	preloadedPendingTransactions,
	transactionChart,
	transactionStats,
	marketData,
	nodeStats,
	blockTime
}) => {
	const { t } = useTranslation();
	const formattedTransactionChart = formatTransactionChart(transactionChart, TRANSACTION_CHART_TYPE.DAILY, t).slice(-14);
	const latestTransactions = useAsyncCall(
		() => fetchTransactionPage({ pageSize: 5 }),
		preloadedLatestTransactions,
		DATA_REFRESH_INTERVAL
	);
	const pendingTransactions = useAsyncCall(
		() => fetchTransactionPage({ pageSize: 5, group: 'unconfirmed' }),
		preloadedPendingTransactions,
		DATA_REFRESH_INTERVAL
	);
	const blocks = useAsyncCall(fetchBlockPage, preloadedBlocks, DATA_REFRESH_INTERVAL);

	const fetchBlockTransactions = useCallback(height => fetchTransactionPage({ pageSize: 160, height }), [fetchTransactionPage]);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>Home</title>
			</Head>
			<RecentBlocks data={blocks.data} onTransactionListRequest={fetchBlockTransactions} />
			<AdditionalSections sections={pageConfig.home.additionalSections} />
			<Section>
				<div className="layout-flex-row-mobile-col">
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalTransactions')}>
								<div title={transactionStats.total}>{numberToShortString(transactionStats.total)}</div>
							</Field>
							<Field title={t('field_transactionsPerBlock')} description={t('field_transactionsPerBlock_description')}>
								{transactionStats.averagePerBlock}
							</Field>
						</div>
						<ChartLine data={formattedTransactionChart} name={t('chart_series_transactions')} />
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_price')}>
								<ValuePrice
									value={truncateDecimals(marketData.price, 7)}
									change={truncateDecimals(marketData.priceChange, 1)}
								/>
							</Field>
							<Field title={t('field_volume')}>${numberToShortString(marketData.volume)}</Field>
						</div>
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_circulatingSupply')} textAlign="right">
								{numberToString(marketData.circulatingSupply)} {config.NATIVE_MOSAIC_TICKER}
							</Field>
							<Field title={t('field_marketCap')} textAlign="right">
								${numberToShortString(marketData.marketCap)}
							</Field>
						</div>
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalNodes')}>{nodeStats.total}</Field>
							{pageConfig.home.showSupernodeCount && nodeStats.supernodes !== null && (
								<Field title={t('field_supernodes')}>{nodeStats.supernodes}</Field>
							)}
						</div>
					</div>
				</div>
			</Section>
			<div className="layout-section-row">
				<Section title={t('section_latestTransactions')}>
					<RecentTransactions data={latestTransactions.data} />
				</Section>
				<Section title={t('section_pendingTransactions')}>
					<RecentTransactions data={pendingTransactions.data} blockTime={blockTime} group="unconfirmed" />
				</Section>
			</div>
		</div>
	);
};

export default Home;
