import { fetchBlockPage, fetchChainStatus } from '@/app/api/blocks';
import { fetchBlockStats } from '@/app/api/stats';
import ChartLine from '@/app/components/ChartLine';
import Field from '@/app/components/Field';
import FieldTimestamp from '@/app/components/FieldTimestamp';
import ItemBlockMobile from '@/app/components/ItemBlockMobile';
import Section from '@/app/components/Section';
import Separator from '@/app/components/Separator';
import Table from '@/app/components/Table';
import ValueAccount from '@/app/components/ValueAccount';
import ValueBlockHeightWithStatus from '@/app/components/ValueBlockHeightWithStatus';
import ValueMosaic from '@/app/components/ValueMosaic';
import ValueTimestamp from '@/app/components/ValueTimestamp';
import styles from '@/app/styles/pages/Home.module.scss';
import { nullableValueToText, useAsyncCall, usePagination } from '@/app/utils';
import { pageConfig } from '@/app/variants/page-config';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	let blocksPage;
	let isBlockPageError = false;
	try {
		blocksPage = await fetchBlockPage();
	} catch {
		// Keep the page available so the client can retry the initial cursor.
		isBlockPageError = true;
		blocksPage = { data: [], pageNumber: 1, isLastPage: false, nextPageParams: null };
	}
	const stats = pageConfig.blocks.showStatistics ? await fetchBlockStats() : null;

	return {
		props: {
			blocks: blocksPage.data,
			blockPage: blocksPage,
			isBlockPageError,
			stats,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Blocks = ({ blocks, blockPage, isBlockPageError, stats }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isError, isLastPage } = usePagination(fetchBlockPage, blocks, {}, {
		initialPage: blockPage,
		initialError: isBlockPageError
	});
	const chainStatus = useAsyncCall(fetchChainStatus, null);
	const renderBlockReward = value => value === null || value === undefined
		? nullableValueToText(value)
		: <ValueMosaic amount={value} isNative />;

	const tableColumns = [
		{
			key: 'height',
			size: '10rem',
			renderValue: (value, row) => <ValueBlockHeightWithStatus block={row} chainStatus={chainStatus} />
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
		...(pageConfig.blocks.showStatementCount ? [{ key: 'statementCount', size: '6.67rem' }] : []),
		...(pageConfig.blocks.showBlockReward
			? [{
				key: 'blockReward',
				size: '7rem',
				renderValue: renderBlockReward
			}]
			: []),
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
				{pageConfig.blocks.showStatistics && (
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
				)}
			</Section>
			<Section>
				<Table
					data={data}
					columns={tableColumns}
					renderItemMobile={data => (
						<ItemBlockMobile
							data={data}
							chainStatus={chainStatus}
							isTransactionCountShown={pageConfig.blocks.showMobileTransactionCount}
							isStatementCountShown={pageConfig.blocks.showStatementCount}
							isBlockRewardShown={pageConfig.blocks.showBlockReward}
						/>
					)}
					isLoading={isLoading}
					isLastPage={isLastPage}
					isError={isError}
					onEndReached={requestNextPage}
					isLastColumnAligned
				/>
			</Section>
		</div>
	);
};

export default Blocks;
