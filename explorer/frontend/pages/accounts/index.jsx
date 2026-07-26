import { fetchAccountPage } from '@/app/api/accounts';
import { search } from '@/app/api/search';
import { fetchAccountStats } from '@/app/api/stats';
import ButtonCSV from '@/app/components/ButtonCSV';
import ChartDonut from '@/app/components/ChartDonut';
import Field from '@/app/components/Field';
import Filter from '@/app/components/Filter';
import ItemAccountMobile from '@/app/components/ItemAccountMobile';
import Section from '@/app/components/Section';
import Separator from '@/app/components/Separator';
import Table from '@/app/components/Table';
import ValueAccount from '@/app/components/ValueAccount';
import ValueMosaic from '@/app/components/ValueMosaic';
import config from '@/app/config';
import styles from '@/app/styles/pages/Home.module.scss';
import { formatAccountCSV, usePagination } from '@/app/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const page = await fetchAccountPage();
	const stats = await fetchAccountStats();

	return {
		props: {
			preloadedData: page.data,
			stats,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Accounts = ({ preloadedData, stats }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isError, isLastPage, filter, changeFilter } = usePagination(fetchAccountPage, preloadedData);

	const tableColumns = [
		{
			key: 'address',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
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
			size: '10rem',
			renderValue: value => <div>{value.toFixed(5)} %</div>
		}
	];
	const filterConfig = [
		{
			name: 'isLatest',
			title: t('filter_latest'),
			type: 'boolean'
		},
		{
			name: 'isActiveHarvesting',
			title: t('filter_activeHarvesting'),
			description: t('filter_activeHarvesting_description', { days: config.PUBLIC_HARVESTING_ACTIVE_WINDOW_DAYS }),
			type: 'boolean'
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_accounts')}</title>
			</Head>
			<Section title={t('section_accounts')}>
				<div className="layout-flex-row-mobile-col">
					<div className="layout-flex-col layout-flex-fill">
						<Field title={t('field_totalAccounts')}>{stats.total}</Field>
						<Field
							title={t('field_harvestingAccounts')}
							description={t('field_harvestingAccounts_description', { days: config.PUBLIC_HARVESTING_ACTIVE_WINDOW_DAYS })}
						>
							{stats.harvesting}
						</Field>
						<Field title={t('field_accountsEligibleForHarvesting')}>{stats.eligibleForHarvesting}</Field>
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<ChartDonut
							data={stats.importanceBreakdown}
							name={t('chart_name_importance_breakdown')}
							label={`${stats.top10AccountsImportance}%`}
						/>
						<ChartDonut
							data={stats.harvestingAccountsChart}
							name={t('chart_name_total_harvesting')}
							label={`${stats.harvestingAccountsPercentage}%`}
						/>
					</div>
				</div>
			</Section>
			<Section>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter data={filterConfig} value={filter} isDisabled={isLoading} onChange={changeFilter} search={search} />
						<ButtonCSV data={data} fileName="accounts" format={row => formatAccountCSV(row, t)} />
					</div>
					<Table
						data={data}
						columns={tableColumns}
						renderItemMobile={data => <ItemAccountMobile data={data} />}
						isLoading={isLoading}
						isError={isError}
						isLastPage={isLastPage}
						onEndReached={requestNextPage}
					/>
				</div>
			</Section>
		</div>
	);
};

export default Accounts;
