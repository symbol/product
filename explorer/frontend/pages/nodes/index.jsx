import { fetchNodeList } from '@/app/api/nodes';
import ItemNodeMobile from '@/app/components/ItemNodeMobile';
import Section from '@/app/components/Section';
import Table from '@/app/components/Table';
import styles from '@/app/styles/pages/Home.module.scss';
import { createPageHref } from '@/app/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const nodeList = await fetchNodeList();

	return {
		props: {
			nodes: nodeList,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Nodes = ({  nodes }) => {
	const { t } = useTranslation();

	const nodeTableColumns = [
		{
			key: 'name',
			size: '30rem',
			renderValue: (value, item) => <Link href={createPageHref('nodes', item.mainPublicKey)}>{value}</Link>
		},
		{
			key: 'endpoint',
			size: '30rem'
		},
		{
			key: 'height',
			size: '8rem'
		},
		{
			key: 'version',
			size: '8rem'
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_nodes')}</title>
			</Head>
			<Section title={t('section_nodes')}>
				<Table
					data={nodes}
					columns={nodeTableColumns}
					renderItemMobile={data => <ItemNodeMobile data={data} />}
					isLastPage
					isLastColumnAligned
				/>
			</Section>
		</div>
	);
};

export default Nodes;
