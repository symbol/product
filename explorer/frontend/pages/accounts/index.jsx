import Field from '@/components/Field';
import ItemBlockMobile from '@/components/ItemBlockMobile';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueMosaic from '@/components/ValueMosaic';
import { fetchAccountCharts, getStats } from '@/pages/api/stats';
import styles from '@/styles/pages/Home.module.scss';
import { useFilter, usePagination } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { fetchAccountPage, getAccountPage } from '@/pages/api/accounts';
import Filter from '@/components/Filter';
import { search } from '../api/search';
import ChartDonut from '@/components/ChartDonut';
import ButtonCSV from '@/components/ButtonCSV';

export const getServerSideProps = async ({ locale }) => {
	const page = await getAccountPage();
	const stats = await getStats();

	return {
		props: {
			preloadedData: page.data,
			stats: stats.accounts,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Accounts = ({ preloadedData, stats }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isLastPage, filter, changeFilter } = usePagination(fetchAccountPage, preloadedData);
	const charts = useFilter(fetchAccountCharts, {}, true);

	const tableColumns = [
		{
			key: 'address',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'name',
			size: '11rem',
		},
		{
			key: 'description',
			size: '21rem'
		},
		{
			key: 'balance',
			size: '15rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'importance',
			size: '7rem',
			renderValue: value => <div>{value}</div>
		},
	];
	const filterConfig = [
        {
            name: 'isLatest',
            title: t('filter_latest'),
            type: 'boolean',
        },
        {
            name: 'isActiveHarvesting',
            title: t('filter_activeHarvesting'),
            type: 'boolean',
        },
        {
            name: 'isService',
            title: t('filter_service'),
            type: 'boolean',
        },
    ];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_accounts')}</title>
			</Head>
			<Section title={t('section_accounts')}>
				<div className="layout-flex-row-mobile-col">
					<div className="layout-flex-col layout-flex-fill">
						<Field title={t('field_totalAccounts')}>
							{stats.total}
						</Field>
						<Field title={t('field_harvestingAccounts')}>
							{stats.harvesting}
						</Field>
						<Field title={t('field_accountsEligibleForHarvesting')}>
							{stats.eligibleForHarvesting}
						</Field>
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<ChartDonut
							data={charts.data.importanceBreakdown}
							name={t('chart_name_importance_breakdown')}
							label="51.1%"
						/>
						<ChartDonut
							data={charts.data.harvestingImportance}
							name={t('chart_name_harvesting_importance')}
							label="34.54%"
						/>
					</div>
				</div>
			</Section>
			<Section>
				<div className='layout-flex-col'>
					<div className='layout-flex-row-mobile-col'>
						<Filter data={filterConfig} isDisabled={isLoading} value={filter} onChange={changeFilter} search={search}/>
						<ButtonCSV data={data} />
					</div>
					<Table
						data={data}
						columns={tableColumns}
						ItemMobile={ItemBlockMobile}
						isLoading={isLoading}
						isLastPage={isLastPage}
						onEndReached={requestNextPage}
					/>
				</div>
			</Section>
		</div>
	);
};

export default Accounts;
