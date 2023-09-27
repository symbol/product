import { getNamespacePage } from '../api/namespaces';
import ItemNamespaceMobile from '@/components/ItemNamespaceMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import styles from '@/styles/pages/Home.module.scss';
import { createPageHref, usePagination } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const namespacePage = await getNamespacePage();

	return {
		props: {
			namespaces: namespacePage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Blocks = ({ namespaces }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, pageNumber, isLastPage } = usePagination(getNamespacePage, namespaces);

	const tableColumns = [
		{
			key: 'name',
			size: '32rem',
			renderValue: value => <Link href={createPageHref('namespaces', value)}>{value}</Link>
		},
		{
			key: 'subNamespaceCount',
			size: '4rem',
			renderValue: value => value
		},
		{
			key: 'creator',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
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

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_namespaces')}</title>
			</Head>
			<Section>
				<Table
					data={data}
					columns={tableColumns}
					ItemMobile={ItemNamespaceMobile}
					isLoading={isLoading}
					isLastPage={isLastPage}
					isLastColumnAligned={true}
					onEndReached={() => requestNextPage({ pageNumber: pageNumber + 1 })}
				/>
			</Section>
		</div>
	);
};

export default Blocks;
