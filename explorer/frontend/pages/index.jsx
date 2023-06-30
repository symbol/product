import CustomImage from '@/components/CustomImage';
import Field from '@/components/Field';
import LineChart from '@/components/LineChart';
import RecentBlocks from '@/components/RecentBlocks';
import RecentTransactions from '@/components/RecentTransactions';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import ValuePrice from '@/components/ValuePrice';
import { getBlockPage } from '@/pages/api/blocks';
import { getStats } from '@/pages/api/stats';
import { getTransactionPage } from '@/pages/api/transactions';
import styles from '@/styles/pages/Home.module.scss';
import { formatDate } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const blocksPage = await getBlockPage();
	const latestTransactionsPage = await getTransactionPage({ pageSize: 5 }, 'confirmed');
	const pendingTransactionsPage = await getTransactionPage({ pageSize: 3 }, 'unconfirmed');
	const stats = await getStats();

	return {
		props: {
			blocks: blocksPage.data,
			latestTransactions: latestTransactionsPage.data,
			pendingTransactions: pendingTransactionsPage.data,
			fees: stats.fees,
			baseInfo: stats.baseInfo,
			chainInfo: stats.chainInfo,
			charts: stats.charts,
			...(await serverSideTranslations(locale, ['common', 'home']))
		}
	};
};

const Home = ({ blocks, fees, latestTransactions, pendingTransactions, baseInfo, chainInfo, charts }) => {
	const { t } = useTranslation('home');
	const { t: commonT } = useTranslation('common');
	const formattedCharts = {
		...charts,
		transactions: charts.transactions.map(item => [formatDate(item[0], commonT), item[1]])
	};

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>Home</title>
			</Head>
			<RecentBlocks data={blocks} />
			<Section>
				<div className="layout-flex-row">
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalTransactions')}>{baseInfo.totalTransactions}</Field>
							<Field title={t('field_transactionsPerBlock')}>{baseInfo.transactionsPerBlock}</Field>
						</div>
						<LineChart data={formattedCharts.transactions} name={t('chart_series_transactions')} />
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_price')}>
								<ValuePrice value={baseInfo.price} change={baseInfo.priceChange} />
							</Field>
							<Field title={t('field_volume')}>${baseInfo.volume}</Field>
						</div>
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_circulatingSupply')} textAlign="right">
								${baseInfo.circulatingSupply}
							</Field>
							<Field title={t('field_treasury')} textAlign="right">
								{baseInfo.treasury} XEM
							</Field>
						</div>
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalNodes')}>{baseInfo.totalNodes}</Field>
							<Field title={t('field_supernodes')}>{baseInfo.supernodes}</Field>
						</div>
						<CustomImage src="/images/stub-node-chart.svg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
					</div>
				</div>
			</Section>
			<div className="layout-section-row">
				<Section title={t('section_fees')}>
					<div className="layout-flex-row">
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
					<div className="layout-flex-row">
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
			</div>
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
