import Field from '@/components/Field';
import ItemBlockMobile from '@/components/ItemBlockMobile';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueMosaic from '@/components/ValueMosaic';
import { getStats } from '@/pages/api/stats';
import styles from '@/styles/pages/Home.module.scss';
import { usePagination } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { fetchAccountPage, getAccountPage } from '@/pages/api/accounts';
import Filter from '@/components/Filter';
import { search } from '../api/search';
import DonutChart from '@/components/DonutChart';
import ButtonCSV from '@/components/ButtonCSV';

export const getServerSideProps = async ({ locale }) => {
	const page = await getAccountPage();
	const stats = await getStats();

	return {
		props: {
			preloadedData: page.data,
			chainInfo: stats.chainInfo,
			charts: stats.charts,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Accounts = ({ preloadedData, chainInfo, charts }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isLastPage, filter, changeFilter } = usePagination(fetchAccountPage, preloadedData);

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
			renderValue: value => <ValueMosaic amount={value} isNative />
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
				<div className="layout-flex-row">
					<div className="layout-flex-col layout-flex-fill">
						<Field title={t('field_blockGenerationTime')}>
							{t('value_blockGenerationTime', { value: chainInfo.blockGenerationTime })}
						</Field>
						<Field title={t('field_blockGenerationTime')}>
							{t('value_blockGenerationTime', { value: chainInfo.blockGenerationTime })}
						</Field>
						<Field title={t('field_blockGenerationTime')}>
							{t('value_blockGenerationTime', { value: chainInfo.blockGenerationTime })}
						</Field>
						<Field title={t('field_blockGenerationTime')}>
							{t('value_blockGenerationTime', { value: chainInfo.blockGenerationTime })}
						</Field>
					</div>
					<Separator className="no-mobile" />
					<div className="layout-grid-row layout-flex-fill">
						<DonutChart
							data={[[30, 'address'], [12, 'azaza'], [5, 'small']]}
							name={'Top 10 Account\nImportance Breakdown'}
							label="51.1%"
						/>
						<DonutChart
							data={[[30, 'address'], [12, 'azaza'], [5, 'small']]}
							name={'Total Harvesting\nAccount Importance'}
							label="34.54%"
						/>
					</div>
				</div>
			</Section>
			<Section>
				<div className='layout-flex-col'>
					<div className='layout-flex-row'>
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
