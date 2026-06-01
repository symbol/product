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
import { createPageHref, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const emptyAccountPage = { data: [] };

const fetchInitialAccountPage = async () => {
	try {
		return await fetchAccountPage();
	} catch (error) {
		if (error.response?.status !== 429)
			throw error;

		// eslint-disable-next-line no-console
		console.error('[AccountList] Initial account page fetch failed:', error);

		return emptyAccountPage;
	}
};

export const getServerSideProps = async ({ locale }) => {
	const [page, stats, translations] = await Promise.all([
		fetchInitialAccountPage(),
		fetchAccountStats(),
		serverSideTranslations(locale, ['common'])
	]);

	return {
		props: {
			preloadedData: page.data,
			stats,
			...translations
		}
	};
};

const formatNamespaceCSVValue = namespaces => (namespaces?.length ? namespaces.join(', ') : 'N/A');

export const formatAccountListCSV = (row, translate) => ({
	[translate('table_field_address')]: row.address,
	...(pageConfig.accounts.showNamespace
		? {
			[translate('table_field_namespace')]: formatNamespaceCSVValue(row.namespaces)
		}
		: {}),
	[translate('table_field_description')]: row.description,
	[translate('table_field_balance')]: row.balance,
	[translate('table_field_importance')]: row.importance
});

const Accounts = ({ preloadedData, stats }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isError, isLastPage, filter, changeFilter } = usePagination(fetchAccountPage, preloadedData);

	const tableColumns = [
		{
			key: 'address',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		...(pageConfig.accounts.showNamespace
			? [
				{
					key: 'namespaces',
					size: '16rem',
					renderTitle: () => t('table_field_namespace'),
					renderValue: value => (
						<span className={styles.tableValueWrap}>
							{value?.length
								? value.map((namespace, index) => (
									<span key={namespace}>
										{index ? ', ' : ''}
										<Link href={createPageHref('namespaces', namespace)}>{namespace}</Link>
									</span>
								))
								: 'N/A'}
						</span>
					)
				}
			]
			: []),
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
		...(pageConfig.accounts.showLatestFilter
			? [
				{
					name: 'isLatest',
					title: t('filter_latest'),
					type: 'boolean',
					off: ['isRichList']
				}
			]
			: []),
		...(pageConfig.accounts.showRichListFilter
			? [
				{
					name: 'isRichList',
					title: t('filter_richList'),
					type: 'boolean',
					off: ['isLatest']
				}
			]
			: []),
		...(pageConfig.accounts.showActiveHarvestingFilter
			? [
				{
					name: 'isActiveHarvesting',
					title: t('filter_activeHarvesting'),
					type: 'boolean'
				}
			]
			: [])
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
						<ButtonCSV data={data} fileName="accounts" format={row => formatAccountListCSV(row, t)} />
					</div>
					<Table
						data={data}
						columns={tableColumns}
						renderItemMobile={data => (
							<ItemAccountMobile data={data} showHarvesting={pageConfig.accounts.showActiveHarvestingFilter} />
						)}
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
