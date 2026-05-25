import { fetchNodeList } from '@/api/nodes';
import ItemNodeMobile from '@/components/ItemNodeMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueMosaic from '@/components/ValueMosaic';
import styles from '@/styles/pages/Home.module.scss';
import { createPageHref } from '@/utils';
import { pageConfig } from '@/variants';
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

const Nodes = ({ nodes }) => {
	const { t } = useTranslation();

	const nodeTableColumns = [
		...(pageConfig.nodes.showAddress
			? [
				{
					key: 'address',
					size: '19%',
					renderValue: value => <span className={styles.tableValueWrap}>{value}</span>
				}
			]
			: []),
		{
			key: 'name',
			size: '12%',
			renderValue: (value, item) => (
				<Link className={styles.tableValueWrap} href={createPageHref('nodes', item.mainPublicKey)}>{value}</Link>
			)
		},
		{
			key: 'endpoint',
			size: '19%',
			renderValue: value => <span className={styles.tableValueWrap}>{value}</span>
		},
		{
			key: 'balance',
			size: '11%',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'version',
			size: '8%'
		},
		{
			key: 'height',
			size: '9%'
		},
		{
			key: 'finalizedHeight',
			size: '11%'
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
					renderItemMobile={data => <ItemNodeMobile data={data} showAddress={pageConfig.nodes.showAddress} />}
					isLastPage
					isLastColumnAligned
				/>
			</Section>
		</div>
	);
};

export default Nodes;
