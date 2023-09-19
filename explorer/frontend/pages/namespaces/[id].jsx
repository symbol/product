import { fetchBlockPage } from '../api/blocks';
import { getNamespaceInfo } from '../api/namespaces';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import Progress from '@/components/Progress';
import Section from '@/components/Section';
import ValueAccount from '@/components/ValueAccount';
import ValueCopy from '@/components/ValueCopy';
import styles from '@/styles/pages/NamespaceInfo.module.scss';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import { arrayToText, nullableValueToText } from '@/utils';

export const getServerSideProps = async ({ locale, params }) => {
	const namespaceInfo = await getNamespaceInfo(params.id);

	if (!namespaceInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			namespaceInfo,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const MosaicInfo = ({ namespaceInfo }) => {
	const { t } = useTranslation();
	const [chainHeight, setChainHeight] = useState(0);
	const [expireIn, setExpireIn] = useState(0);
	const isExpired = expireIn < 0;
	const expirationText = isExpired ? t('value_expired') : t('value_expiration', { value: expireIn });
	const progressType = isExpired ? 'danger' : '';

	useEffect(() => {
		const fetchChainHeight = async () => {
			const { data } = await fetchBlockPage();

			if (data[0]) {
				const chainHeight= data[0].height;
				const expireIn = namespaceInfo.expirationHeight - chainHeight;
				setChainHeight(chainHeight);
				setExpireIn(expireIn)
			}
		};
		fetchChainHeight();
	}, []);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_namespaceInfo')}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_namespace')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="namespace" value={namespaceInfo.id} size="xl" />
						<Field title={t('field_name')}>
							<div className="value-highlighted">{namespaceInfo.name}</div>
						</Field>
						<Field title={t('field_id')}>
							<ValueCopy value={namespaceInfo.id} />
						</Field>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_rootNamespace')}>
							{nullableValueToText(namespaceInfo.rootNamespace)}
						</Field>
						<Field title={t('field_subNamespaces')}>
							{arrayToText(namespaceInfo.subNamespaces)}
						</Field>
						<Field title={t('field_owner')}>
							<ValueAccount address={namespaceInfo.owner} size="sm" />
						</Field>
						<Field title={t('field_expiration')} description={t('field_namespaceExpiration_description')}>
							{expirationText}
						</Field>
						<Progress
							titleLeft={t('field_registrationHeight')}
							titleRight={t('field_expirationHeight')}
							valueLeft={namespaceInfo.registrationHeight}
							valueRight={namespaceInfo.expirationHeight}
							value={chainHeight}
							type={progressType}
						/>
					</div>
				</Section>
			</div>
		</div>
	);
};

export default MosaicInfo;
