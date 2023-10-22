import { fetchAccountPage } from '@/api/accounts';
import { search } from '@/api/search';
import { fetchAccountStats } from '@/api/stats';
import ButtonCSV from '@/components/ButtonCSV';
import ChartDonut from '@/components/ChartDonut';
import Field from '@/components/Field';
import Filter from '@/components/Filter';
import ItemAccountMobile from '@/components/ItemAccountMobile';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueMosaic from '@/components/ValueMosaic';
import styles from '@/styles/pages/Home.module.scss';
import { usePagination } from '@/utils';
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
			type: 'boolean'
		},
		{
			name: 'isService',
			title: t('filter_service'),
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
						<Field title={t('field_harvestingAccounts')}>{stats.harvesting}</Field>
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
							data={stats.harvestingImportance}
							name={t('chart_name_harvesting_importance')}
							label={`${stats.harvesting}%`}
						/>
					</div>
				</div>
			</Section>
			<Section>
				<div className="layout-flex-col">
					<div className="layout-flex-row-mobile-col">
						<Filter data={filterConfig} isDisabled={isLoading} value={filter} onChange={changeFilter} search={search} />
						<ButtonCSV data={data} />
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
