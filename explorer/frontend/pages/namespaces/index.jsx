import { fetchChainHight } from '@/api/blocks';
import { fetchNamespacePage } from '@/api/namespaces';
import Filter from '@/components/Filter';
import ItemNamespaceMobile from '@/components/ItemNamespaceMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueLabel from '@/components/ValueLabel';
import styles from '@/styles/pages/Home.module.scss';
import { createExpirationLabel, createPageHref, useAsyncCall, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const namespacePage = await fetchNamespacePage();

	return {
		props: {
			namespaces: namespacePage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Blocks = ({ namespaces }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isLastPage, isError, filter, changeFilter } = usePagination(fetchNamespacePage, namespaces);
	const chainHeight = useAsyncCall(fetchChainHight, 0);
	const namespaceFilterConfig = [
		{
			name: 'isRecent',
			title: t('filter_latest'),
			type: 'boolean',
			off: ['isAddressAlias', 'isMosaicAlias', 'isRoot', 'isSub']
		},
		{
			name: 'isAddressAlias',
			title: t('filter_addressAlias'),
			type: 'boolean',
			off: ['isRecent', 'isMosaicAlias', 'isRoot', 'isSub']
		},
		{
			name: 'isMosaicAlias',
			title: t('filter_mosaicAlias'),
			type: 'boolean',
			off: ['isRecent', 'isAddressAlias', 'isRoot', 'isSub']
		},
		{
			name: 'isRoot',
			title: t('filter_rootNamespace'),
			type: 'boolean',
			off: ['isRecent', 'isAddressAlias', 'isMosaicAlias', 'isSub']
		},
		{
			name: 'isSub',
			title: t('filter_subNamespace'),
			type: 'boolean',
			off: ['isRecent', 'isAddressAlias', 'isMosaicAlias', 'isRoot']
		}
	];

	const tableColumns = [
		{
			key: 'name',
			size: '20rem',
			renderTitle: () => t(pageConfig.namespaces.namespaceIdColumnTitleKey),
			renderValue: value => <Link href={createPageHref('namespaces', value)} className={styles.tableValueWrap}>{value}</Link>
		},
		...(pageConfig.namespaces.showSubNamespaceCount
			? [
				{
					key: 'subNamespaceCount',
					size: '4rem',
					renderValue: value => value
				}
			]
			: []),
		...(pageConfig.namespaces.showReadableNamespaceName
			? [
				{
					key: 'namespaceName',
					size: '20rem',
					renderTitle: () => t('table_field_name'),
					renderValue: value => <span className={styles.tableValueWrap}>{value}</span>
				}
			]
			: []),
		{
			key: 'creator',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'status',
			size: '5rem',
			renderValue: (value, row) => {
				const { status, text } = createExpirationLabel(row.expirationHeight, chainHeight, row.isUnlimitedDuration, t);

				return <ValueLabel type={status} title={text} />;
			}
		},
		{
			key: 'registrationHeight',
			size: '10rem',
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'expirationHeight',
			size: '10rem',
			renderValue: value => value
		}
	];

	const table = (
		<Table
			data={data}
			columns={tableColumns}
			renderItemMobile={data => <ItemNamespaceMobile data={data} chainHeight={chainHeight} />}
			isLoading={isLoading}
			isLastPage={isLastPage}
			isError={isError}
			isLastColumnAligned={true}
			onEndReached={requestNextPage}
		/>
	);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_namespaces')}</title>
			</Head>
			<Section title={t('section_namespaces')}>
				{pageConfig.namespaces.showNamespaceFilter ? (
					<div className="layout-flex-col">
						<Filter data={namespaceFilterConfig} value={filter} isDisabled={isLoading} onChange={changeFilter} />
						{table}
					</div>
				) : table}
			</Section>
		</div>
	);
};

export default Blocks;
