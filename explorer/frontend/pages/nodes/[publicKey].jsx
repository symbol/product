import { fetchNodeList } from '@/api/nodes';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import Section from '@/components/Section';
import ValueCopy from '@/components/ValueCopy';
import styles from '@/styles/pages/NodeInfo.module.scss';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale, params }) => {
	const nodeList = await fetchNodeList();
	const nodeInfo = nodeList.find(node => node.mainPublicKey === params.publicKey);

	if (!nodeInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			nodeInfo,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const NodeInfo = ({ nodeInfo }) => {
	const { t } = useTranslation();

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_nodeInfo', { name: nodeInfo.name })}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_node')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="node" size="xl" />
						<Field title={t('field_name')}>
							<div className={`value-highlighted ${styles.name}`}>{nodeInfo.name}</div>
						</Field>
						<Field title={t('field_endpoint')}>
							<ValueCopy value={nodeInfo.endpoint} />
						</Field>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_mainPublicKey')}>
							<ValueCopy value={nodeInfo.mainPublicKey} />
						</Field>
						<Field title={t('field_nodePublicKey')}>
							<ValueCopy value={nodeInfo.nodePublicKey} />
						</Field>
						<Field title={t('field_height')}>
							{nodeInfo.height}
						</Field>
						<Field title={t('field_version')}>
							{nodeInfo.version}
						</Field>
						<Field title={t('field_balance')}>
							{nodeInfo.balance} XEM
						</Field>
					</div>
				</Section>
			</div>
		</div>
	);
};

export default NodeInfo;
