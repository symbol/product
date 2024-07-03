import { fetchChainHight } from '@/api/blocks';
import { fetchNamespaceInfo } from '@/api/namespaces';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemMosaicMobile from '@/components/ItemMosaicMobile';
import Progress from '@/components/Progress';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueList from '@/components/ValueList';
import ValueNamespace from '@/components/ValueNamespace';
import ValueTimestamp from '@/components/ValueTimestamp';
import styles from '@/styles/pages/NamespaceInfo.module.scss';
import { createPageHref, nullableValueToText } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';

export const getServerSideProps = async ({ locale, params }) => {
	const namespaceInfo = await fetchNamespaceInfo(params.id);

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

const NamespaceInfo = ({ namespaceInfo }) => {
	const { t } = useTranslation();
	const [chainHeight, setChainHeight] = useState(0);
	const [expirationText, setExpirationText] = useState(null);
	const [progressType, setProgressType] = useState('');

	const tableColumns = [
		{
			key: 'name',
			size: '40rem',
			renderValue: value => <Link href={createPageHref('mosaics', value)}>{value}</Link>
		},
		{
			key: 'supply',
			size: '15rem',
			renderValue: value => value
		},
		{
			key: 'registrationHeight',
			size: '10rem',
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'registrationTimestamp',
			size: '11rem',
			renderTitle: () => <FieldTimestamp title={t('field_created')} />,
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
	];

	useEffect(() => {
		const fetchChainHeight = async () => {
			const chainHeight = await fetchChainHight();
			const expireIn = namespaceInfo.expirationHeight - chainHeight;
			const isExpired = expireIn < 0;
			const expirationText = namespaceInfo.isUnlimitedDuration
				? t('value_neverExpired')
				: isExpired
					? t('value_expired')
					: t('value_expiration', { value: expireIn });
			const progressType = isExpired ? 'danger' : '';
			setChainHeight(chainHeight);
			setExpirationText(expirationText);
			setProgressType(progressType);
		};
		fetchChainHeight();
	}, [namespaceInfo]);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_namespaceInfo', { name: namespaceInfo.name })}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_namespace')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="namespace" value={namespaceInfo.id} size="xl" />
						<Field title={t('field_name')}>
							<div className="value-highlighted">{namespaceInfo.name}</div>
						</Field>
						<FieldTimestamp title={t('field_created')} value={namespaceInfo.registrationTimestamp} hasTime />
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_subNamespaces')}>
							<ValueList data={namespaceInfo.subNamespaces} max={3} title={t('field_subNamespaces')} />
						</Field>
						<Field title={t('field_creator')}>
							<ValueAccount address={namespaceInfo.creator} size="sm" />
						</Field>
						<Field title={t('field_expiration')} description={t('field_namespaceExpiration_description')}>
							{nullableValueToText(expirationText)}
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
			<Section title={t('section_mosaics')}>
				<Table
					sections={namespaceInfo.namespaceMosaics}
					columns={tableColumns}
					renderItemMobile={data => <ItemMosaicMobile data={data} />}
					isLastPage={true}
					isLastColumnAligned={true}
					renderSectionHeader={section => (
						<ValueNamespace namespaceName={section.namespaceName} namespaceId={section.namespaceId} size="md" />
					)}
				/>
			</Section>
		</div>
	);
};

export default NamespaceInfo;
