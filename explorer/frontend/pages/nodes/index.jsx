import { fetchNodeList } from '@/api/nodes';
import Field from '@/components/Field';
import Filter from '@/components/Filter';
import ItemNodeMobile from '@/components/ItemNodeMobile';
import NodeMap from '@/components/NodeMap';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueMosaic from '@/components/ValueMosaic';
import styles from '@/styles/pages/NodeList.module.scss';
import { createPageHref, formatNodeRoles } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState } from 'react';

const ROLE_FILTER_VALUES = [1, 2, 3, 4, 5, 6, 7];

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
	const [filter, setFilter] = useState({});
	const visibleNodes = filter.role
		? nodes.filter(node => (node.roles & 7) === filter.role)
		: nodes;
	const roleFilterConfig = [
		{
			name: 'role',
			title: t('filter_role'),
			type: 'node-role',
			options: ROLE_FILTER_VALUES.map(roles => ({
				value: roles,
				label: formatNodeRoles(roles)
			}))
		}
	];
	const nodeRoleStats = ROLE_FILTER_VALUES.map(roles => ({
		roles,
		label: formatNodeRoles(roles),
		count: nodes.filter(node => (node.roles & 7) === roles).length
	}));

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
			key: pageConfig.nodes.showRoles ? 'roles' : 'endpoint',
			size: '19%',
			renderValue: value => (
				<span className={styles.tableValueWrap}>{pageConfig.nodes.showRoles ? formatNodeRoles(value, t) : value}</span>
			)
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
				<div className={styles.stats} data-testid="node-stats">
					<Field title={t('field_totalNodes')}>{nodes.length}</Field>
					{pageConfig.nodes.showRoles && nodeRoleStats.map(({ roles, label, count }) => (
						<Field key={roles} title={label}>{count}</Field>
					))}
				</div>
			</Section>
			<Section>
				<div className="layout-flex-col">
					{pageConfig.nodes.showRoles && <Filter data={roleFilterConfig} value={filter} onChange={setFilter} />}
					<NodeMap nodes={visibleNodes} showRoles={pageConfig.nodes.showRoles} />
					<Table
						data={visibleNodes}
						columns={nodeTableColumns}
						renderItemMobile={data => (
							<ItemNodeMobile data={data} showAddress={pageConfig.nodes.showAddress} showRoles={pageConfig.nodes.showRoles} />
						)}
						isLastPage
						isLastColumnAligned
					/>
				</div>
			</Section>
		</div>
	);
};

export default Nodes;
