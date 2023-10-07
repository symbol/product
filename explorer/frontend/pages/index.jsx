import { fetchBlockPage } from '@/api/blocks';
import { fetchMarketData, fetchStats } from '@/api/stats';
import { fetchTransactionPage } from '@/api/transactions';
import ChartLine from '@/components/ChartLine';
import CustomImage from '@/components/CustomImage';
import Field from '@/components/Field';
import RecentBlocks from '@/components/RecentBlocks';
import RecentTransactions from '@/components/RecentTransactions';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import ValuePrice from '@/components/ValuePrice';
import styles from '@/styles/pages/Home.module.scss';
import { formatDate, numberToShortString, truncateDecimals } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const blocksPage = await fetchBlockPage();
	const latestTransactionsPage = await fetchTransactionPage({ pageSize: 5 }, 'confirmed');
	const pendingTransactionsPage = await fetchTransactionPage({ pageSize: 3 }, 'unconfirmed');
	const stats = await fetchStats();
	const marketData = await fetchMarketData();

	return {
		props: {
			marketData,
			blocks: blocksPage.data,
			latestTransactions: latestTransactionsPage.data,
			pendingTransactions: pendingTransactionsPage.data,
			fees: stats.fees,
			baseInfo: stats.baseInfo,
			chainInfo: stats.chainInfo,
			charts: stats.charts,
			transactionInfo: stats.transactions,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Home = ({ blocks, fees, latestTransactions, pendingTransactions, baseInfo, chainInfo, charts, transactionInfo, marketData }) => {
	const { t } = useTranslation();
	const formattedCharts = {
		...charts,
		transactions: charts.transactions.map(item => [formatDate(item[0], t), item[1]])
	};

	const fetchBlockTransactions = height => fetchTransactionPage({ pageSize: 160 }, { height });

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>Home</title>
			</Head>
			<RecentBlocks data={blocks} onTransactionListRequest={fetchBlockTransactions} />
			<Section>
				<div className="layout-flex-row-mobile-col">
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalTransactions')}>{numberToShortString(transactionInfo.totalAll)}</Field>
							<Field title={t('field_transactionsPerBlock')} description={t('field_transactionsPerBlock_description')}>
								{transactionInfo.averagePerBlock}
							</Field>
						</div>
						<ChartLine data={formattedCharts.transactions} name={t('chart_series_transactions')} />
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_price')}>
								<ValuePrice
									value={truncateDecimals(marketData.price, 3)}
									change={truncateDecimals(marketData.priceChange, 1)}
								/>
							</Field>
							<Field title={t('field_volume')}>${numberToShortString(marketData.volume)}</Field>
						</div>
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_circulatingSupply')} textAlign="right">
								${numberToShortString(marketData.circulatingSupply)}
							</Field>
							<Field title={t('field_treasury')} textAlign="right">
								{numberToShortString(baseInfo.treasury)} XEM
							</Field>
						</div>
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalNodes')}>{baseInfo.totalNodes}</Field>
							<Field title={t('field_supernodes')}>{baseInfo.supernodes}</Field>
						</div>
						<CustomImage src="/images/stub-node-chart.svg" style={{ width: '100%', objectFit: 'contain' }} />
					</div>
				</div>
			</Section>
			{/* <div className="layout-section-row">
				<Section title={t('section_fees')}>
					<div className="layout-flex-row-mobile-col">
						<div className="layout-flex-fill">
							<Field title={t('field_feeSlow')}>{fees.slow} XEM</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_feeMedium')}>{fees.medium} XEM</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_feeFast')}>{fees.fast} XEM</Field>
						</div>
					</div>
				</Section>
				<Section title={t('section_chain')}>
					<div className="layout-flex-row-mobile-col">
						<div className="layout-flex-fill">
							<Field title={t('field_height')}>{chainInfo.height}</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_lastSafeBlock')}>{chainInfo.lastSafeBlock}</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_currentBlockTime')}>{chainInfo.blockGenerationTime}</Field>
						</div>
					</div>
				</Section>
			</div> */}
			<div className="layout-section-row">
				<Section title={t('section_latestTransactions')}>
					<RecentTransactions data={latestTransactions} />
				</Section>
				<Section title={t('section_pendingTransactions')}>
					<RecentTransactions data={pendingTransactions} />
				</Section>
			</div>
		</div>
	);
};

export default Home;
