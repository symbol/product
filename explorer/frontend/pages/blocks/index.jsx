import Field from '@/components/Field';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import styles from '@/styles/pages/Home.module.scss';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Table from '@/components/Table';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueMosaic from '@/components/ValueMosaic';
import ValueAccount from '@/components/ValueAccount';
import ItemBlockMobile from '@/components/ItemBlockMobile';
import LineChart from '@/components/LineChart';
import { fetchBlockPage, getBlockPage } from '@/pages/api/blocks';
import { getStats } from '@/pages/api/stats';
import { usePagination } from '@/utils';
import Link from 'next/link';

export const getStaticProps = async ({ locale }) => {
	const blocksPage = await getBlockPage();
	const stats = await getStats();

	return {
		props: {
			blocks: blocksPage.data,
			chainInfo: stats.chainInfo,
			charts: stats.charts,
			...(await serverSideTranslations(locale, ['common', 'blocks'])),
		},
	}
};

const Blocks = ({ blocks, chainInfo, charts }) => {
	const { t } = useTranslation('blocks');
	const [loadBlockPage, blockList, isLoading, pageNumber, isLastPage] = usePagination(
        fetchBlockPage,
        blocks,
    );

    const tableColumns = [
        {
            key: 'height',
            size: '8rem',
			renderValue: (value) => <Link href={`/blocks/${value}`}>{value}</Link>
        },
        {
            key: 'harvester',
            size: '30rem',//'27.33rem',
			renderValue: (value) => <ValueAccount address={value} size="sm" />
        },
        {
            key: 'transactionCount',
            size: '6.67rem',
        },
        {
            key: 'totalFee',
            size: '7rem',
			renderValue: (value) => <ValueMosaic amount={value} isNative hasTime/>
        },
        {
            key: 'reward',
            size: '7rem',
			renderValue: (value) => <ValueMosaic amount={value} isNative hasTime/>
        },
        {
            key: 'timestamp',
            size: '11rem',
			renderValue: (value) => <ValueTimestamp value={value} hasTime/>
        },
    ]

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_blocks')}</title>
			</Head>
			<Section title={t('section_blocks')}>
				<div className="layout-flex-row">
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_blockGenerationTime')}>
                                {t('value_blockGenerationTime', {value: chainInfo.blockGenerationTime})}
							</Field>
						</div>
						<LineChart data={charts.blockTime} name={t('chart_series_blockTime')} />
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_averageFee')}>
                            {t('value_averageFee', {value: chainInfo.averageFee})}
							</Field>
						</div>
						<LineChart data={charts.fee} name={t('chart_series_fee')} />
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<div className="layout-flex-col layout-flex-fill">
							<Field title={t('field_difficulty')}>
								{chainInfo.difficulty}%
							</Field>
						</div>
						<LineChart data={charts.difficulty} name={t('chart_series_difficulty')} />
					</div>
				</div>
			</Section>
            <Section>
                <Table
					data={blockList}
					columns={tableColumns}
					ItemMobile={ItemBlockMobile}
					isLoading={isLoading}
					isLastPage={isLastPage}
					onEndReached={() => loadBlockPage({ pageNumber: pageNumber + 1 })}
				/>
            </Section>
		</div>
	)
};

export default Blocks;
