import { fetchChainHight } from '@/api/blocks';
import { fetchNamespaceInfo, fetchNamespaceMetadataPage, fetchNamespaceReceiptPage } from '@/api/namespaces';
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
import ValueMosaic from '@/components/ValueMosaic';
import ValueNamespace from '@/components/ValueNamespace';
import ValueTimestamp from '@/components/ValueTimestamp';
import styles from '@/styles/pages/NamespaceInfo.module.scss';
import { createPageHref, nullableValueToText, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
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

	const namespaceMetadataPage = pageConfig.namespaces.showNamespaceMetadataSection
		? await fetchNamespaceMetadataPage({ targetId: namespaceInfo.id })
		: { data: [] };
	const namespaceReceiptPage = pageConfig.namespaces.showNamespaceReceiptSection
		? await fetchNamespaceReceiptPage({ height: namespaceInfo.registrationHeight })
		: { data: [] };

	return {
		props: {
			namespaceInfo,
			...(pageConfig.namespaces.showNamespaceMetadataSection && { metadataEntries: namespaceMetadataPage.data }),
			...(pageConfig.namespaces.showNamespaceReceiptSection && { balanceTransferReceipts: namespaceReceiptPage.data }),
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const NamespaceInfo = ({ namespaceInfo, metadataEntries = [], balanceTransferReceipts = [] }) => {
	const { t } = useTranslation();
	const metadataPagination = usePagination(fetchNamespaceMetadataPage, metadataEntries, { targetId: namespaceInfo.id });
	const receiptPagination = usePagination(fetchNamespaceReceiptPage, balanceTransferReceipts, { height: namespaceInfo.registrationHeight });
	const [chainHeight, setChainHeight] = useState(0);
	const [expirationText, setExpirationText] = useState(null);
	const [progressType, setProgressType] = useState('');
	const aliasTypeText = namespaceInfo.aliasType ? t(`value_namespaceAliasType_${namespaceInfo.aliasType}`) : null;

	const mosaicTableColumns = [
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
	const namespaceLevelTableColumns = [
		{
			key: 'name',
			size: '20rem',
			renderValue: value => nullableValueToText(value)
		},
		{
			key: 'namespaceId',
			size: '30rem',
			renderTitle: () => t('table_field_namespaceId'),
			renderValue: value => (
				<Link href={createPageHref('namespaces', value)} className={styles.namespaceValue}>
					{value}
				</Link>
			)
		},
		{
			key: 'parentId',
			size: '30rem',
			renderTitle: () => t('table_field_parentId'),
			renderValue: value => value ? (
				<Link href={createPageHref('namespaces', value)} className={styles.namespaceValue}>
					{value}
				</Link>
			) : t('value_namespaceAliasType_none')
		}
	];
	const metadataTableColumns = [
		{
			key: 'scopedMetadataKey',
			size: '20rem',
			renderTitle: () => t('table_field_scopedMetadataKey'),
			renderValue: value => <span className={styles.namespaceValue}>{nullableValueToText(value)}</span>
		},
		{
			key: 'senderAddress',
			size: '24rem',
			renderTitle: () => t('table_field_senderAddress'),
			renderValue: value => <ValueAccount address={value} size="sm" className={styles.metadataAddress} />
		},
		{
			key: 'targetAddress',
			size: '24rem',
			renderTitle: () => t('table_field_targetAddress'),
			renderValue: value => <ValueAccount address={value} size="sm" className={styles.metadataAddress} />
		},
		{
			key: 'value',
			size: '32rem',
			renderValue: value => <span className={styles.metadataValue}>{nullableValueToText(value)}</span>
		}
	];
	const receiptTableColumns = [
		{
			key: 'version',
			size: '10rem',
			renderValue: value => value
		},
		{
			key: 'type',
			size: '20rem',
			renderValue: value => t(`receiptType_${value}`)
		},
		{
			key: 'to',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" className={styles.metadataAddress} />
		},
		{
			key: 'mosaic',
			size: '32rem',
			renderTitle: () => t('table_field_mosaics'),
			renderValue: value => (
				<ValueMosaic
					mosaicId={value.id}
					mosaicName={value.name}
					amount={value.amount}
					isNative={value.isNative}
					isTickerShown
					className={styles.receiptMosaic}
				/>
			)
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
						{pageConfig.namespaces.showReadableNamespaceName && (
							<Field title={t('field_namespaceName')}>
								<div className={`${styles.namespaceValue} value-highlighted`}>
									{nullableValueToText(namespaceInfo.namespaceName)}
								</div>
							</Field>
						)}
						<Field title={t(pageConfig.namespaces.namespaceIdFieldTitleKey)}>
							<div className={`${styles.namespaceValue} ${styles.namespaceIdValue} value-highlighted`}>{namespaceInfo.id}</div>
						</Field>
						{pageConfig.namespaces.showNamespaceRegistrationTimestamp && (
							<FieldTimestamp title={t('field_created')} value={namespaceInfo.registrationTimestamp} hasTime />
						)}
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						{pageConfig.namespaces.showSubNamespaces && (
							<Field title={t('field_subNamespaces')}>
								<ValueList data={namespaceInfo.subNamespaces} max={3} title={t('field_subNamespaces')} />
							</Field>
						)}
						{pageConfig.namespaces.showNamespaceAliasFields && (
							<Field title={t('field_aliasType')}>{nullableValueToText(aliasTypeText)}</Field>
						)}
						{pageConfig.namespaces.showNamespaceAliasFields && namespaceInfo.aliasType === 'mosaic' && (
							<Field title={t('field_aliasMosaic')}>
								{namespaceInfo.aliasMosaicId ? (
									<Link href={createPageHref('mosaics', namespaceInfo.aliasMosaicId)} className={styles.namespaceValue}>
										{namespaceInfo.aliasMosaicId}
									</Link>
								) : nullableValueToText(namespaceInfo.aliasMosaicId)}
							</Field>
						)}
						{pageConfig.namespaces.showNamespaceAliasFields && namespaceInfo.aliasType === 'address' && (
							<Field title={t('field_aliasAddress')}>
								<ValueAccount address={namespaceInfo.aliasAddress} size="sm" />
							</Field>
						)}
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
			{pageConfig.namespaces.showNamespaceMosaicSection && (
				<Section title={t('section_mosaics')}>
					<Table
						sections={namespaceInfo.namespaceMosaics}
						columns={mosaicTableColumns}
						renderItemMobile={data => <ItemMosaicMobile data={data} />}
						isLastPage={true}
						isLastColumnAligned={true}
						renderSectionHeader={section => (
							<ValueNamespace namespaceName={section.namespaceName} namespaceId={section.namespaceId} size="md" />
						)}
					/>
				</Section>
			)}
			{pageConfig.namespaces.showNamespaceLevelSection && (
				<Section title={t('section_namespaceLevel')}>
					<Table
						data={namespaceInfo.namespaceLevels}
						columns={namespaceLevelTableColumns}
						isLastPage={true}
						isHeaderSticky={false}
					/>
				</Section>
			)}
			{pageConfig.namespaces.showNamespaceMetadataSection && (
				<Section title={t('section_metadataEntries')}>
					<Table
						data={metadataPagination.data}
						columns={metadataTableColumns}
						isLoading={metadataPagination.isLoading}
						isError={metadataPagination.isError}
						isLastPage={metadataPagination.isLastPage}
						onEndReached={metadataPagination.requestNextPage}
						isHeaderSticky={false}
					/>
				</Section>
			)}
			{pageConfig.namespaces.showNamespaceReceiptSection && (
				<Section title={t('section_balanceTransferReceipt')}>
					<Table
						data={receiptPagination.data}
						columns={receiptTableColumns}
						isLoading={receiptPagination.isLoading}
						isError={receiptPagination.isError}
						isLastPage={receiptPagination.isLastPage}
						onEndReached={receiptPagination.requestNextPage}
						isHeaderSticky={false}
					/>
				</Section>
			)}
		</div>
	);
};

export default NamespaceInfo;
