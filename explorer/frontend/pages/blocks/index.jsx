import { fetchBlockPage } from '@/api/blocks';
import { fetchBlockStats, fetchStats } from '@/api/stats';
import ChartLine from '@/components/ChartLine';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemBlockMobile from '@/components/ItemBlockMobile';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTimestamp from '@/components/ValueTimestamp';
import styles from '@/styles/pages/Home.module.scss';
import { usePagination } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const blocksPage = await fetchBlockPage();
	const stats = await fetchBlockStats();

	return {
		props: {
			blocks: blocksPage.data,
			stats,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Blocks = ({ blocks, stats }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, pageNumber, isLastPage } = usePagination(fetchBlockPage, blocks);

	const tableColumns = [
		{
			key: 'height',
			size: '8rem',
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'harvester',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'transactionCount',
			size: '6.67rem'
		},
		{
			key: 'totalFee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'timestamp',
			size: '11rem',
			renderTitle: () => <FieldTimestamp />,
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_blocks')}</title>
			</Head>
			<Section title={t('section_blocks')}>
				<div className="layout-flex-row-mobile-col">
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_blockGenerationTime')}>
								{t('value_blockGenerationTime', { value: stats.blockTime })}
							</Field>
						</div>
						<ChartLine data={stats.blockTimeChart} name={t('chart_series_blockTime')} />
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_averageFee')}>{t('value_averageFee', { value: stats.blockFee })}</Field>
						</div>
						<ChartLine data={stats.blockFeeChart} name={t('chart_series_fee')} />
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_difficulty')}>{stats.blockDifficulty}%</Field>
						</div>
						<ChartLine data={stats.blockDifficultyChart} name={t('chart_series_difficulty')} />
					</div>
				</div>
			</Section>
			<Section>
				<Table
					data={data}
					columns={tableColumns}
					renderItemMobile={data => <ItemBlockMobile data={data} />}
					isLoading={isLoading}
					isLastPage={isLastPage}
					onEndReached={() => requestNextPage({ pageNumber: pageNumber + 1 })}
				/>
			</Section>
		</div>
	);
};

export default Blocks;
