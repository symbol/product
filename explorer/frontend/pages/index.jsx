import RecentBlocks from '@/components/RecentBlocks';
import Field from '@/components/Field';
import FieldPrice from '@/components/FieldPrice';
import RecentTransactions from '@/components/RecentTransactions';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import styles from '@/styles/pages/Home.module.scss';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

export const getStaticProps = async ({ locale }) => {
	const blocks = new Array(50).fill(null).map((item, index) => {
		const transactionCount = Math.floor(Math.random() * 10);
		const timestamp = new Date(Date.now() - 15 * index * 60000).getTime();
		const transactionFees = new Array(transactionCount).fill(null).map(() => ({
			fee: Math.floor(Math.random() * 100) / 100,
			size: Math.floor(Math.random() * 300 + 100),
		}));

		return {
			height: 3999820 - index,
			timestamp,
			transactionCount,
			totalFee: + transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2),
			transactionFees
		}
	});

	const fees = {
		slow: 0.001,
		medium: 0.005,
		fast: 0.01
	}

	const latestTransactions = [
		{
			type: 'transfer',
			hash: '7EC5...1147',
			timestamp: 1686426584280,
			fee: 0.65,
			amount: 20471.65
		}, {
			type: 'transfer',
			hash: '7EC5...1147',
			timestamp: 1686426584280,
			fee: 0.65,
			amount: 20471.65
		}, {
			type: 'transfer',
			hash: '7EC5...1147',
			timestamp: 1686426584280,
			fee: 0.65,
			amount: 20471.65
		}, {
			type: 'transfer',
			hash: '7EC5...1147',
			timestamp: 1686426584280,
			fee: 0.65,
			amount: 20471.65
		}, {
			type: 'transfer',
			hash: '7EC5...1147',
			timestamp: 1686426584280,
			fee: 0.65,
			amount: 20471.65
		},
	];

	const baseInfo = {
		totalTransactions: 99888777154,
		transactionsPerBlock: 15,
		price: 5.17,
		priceChange: 13,
		volume: 1200000000,
		circulatingSupply: 999999999999,
		treasury: 628549820,
		totalNodes: 145,
		supernodes: 66,
	};

	const chainInfo = {
		height: 3999820,
		lastSafeBlock: 399120,
		currentBlockTime: 15,
	}

	return {
		props: {
			blocks,
			fees,
			latestTransactions,
			baseInfo,
			chainInfo,
			...(await serverSideTranslations(locale, ['common', 'home'])),
		},
	}
};

const Home = ({blocks, fees, latestTransactions, baseInfo, chainInfo}) => {
	const { t } = useTranslation('home');

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
							<Field title={t('field_totalTransactions')}>
								{baseInfo.totalTransactions}
							</Field>
							<Field title={t('field_transactionsPerBlock')}>
								{baseInfo.transactionsPerBlock}
							</Field>
						</div>
						<img src="/images/stub-price-chart.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_price')}>
								<FieldPrice value={baseInfo.price} change={baseInfo.priceChange} />
							</Field>
							<Field title={t('field_volume')}>
								${baseInfo.volume}
							</Field>
						</div>
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_circulatingSupply')} textAlign="right">
								${baseInfo.circulatingSupply}
							</Field>
							<Field title={t('field_treasury')} textAlign="right">
								{baseInfo.treasury}XEM
							</Field>
						</div>
					</div>
					<Separator />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_totalNodes')}>
								{baseInfo.totalNodes}
							</Field>
							<Field title={t('field_supernodes')}>
								{baseInfo.supernodes}
							</Field>
						</div>
						<img src="/images/stub-node-chart.svg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
					</div>
				</div>
			</Section>
			<div className="layout-flex-row">
				<Section title={t('section_fees')}>
					<div className="layout-flex-row">
						<div className="layout-flex-fill">
							<Field title={t('field_feeSlow')}>
								{fees.slow} XEM
							</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_feeMedium')}>
								{fees.medium} XEM
							</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_feeFast')}>
								{fees.fast} XEM
							</Field>
						</div>
					</div>
				</Section>
				<Section title={t('section_chain')}>
					<div className="layout-flex-row">
						<div className="layout-flex-fill">
							<Field title={t('field_height')}>
								{chainInfo.height}
							</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_lastSafeBlock')}>
								{chainInfo.lastSafeBlock}
							</Field>
						</div>
						<div className="layout-flex-fill">
							<Field title={t('field_currentBlockTime')}>
								{chainInfo.currentBlockTime}
							</Field>
						</div>
					</div>
				</Section>
			</div>
			<div className="layout-flex-row">
				<Section title={t('section_pendingTransactions')}>
					<RecentTransactions data={latestTransactions} />
				</Section>
				<Section title={t('section_latestTransactions')}>
					<RecentTransactions data={latestTransactions} />
				</Section>
			</div>
		</div>
	)
};

export default Home;
