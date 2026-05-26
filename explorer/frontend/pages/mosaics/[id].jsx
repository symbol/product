import { fetchAccountPage } from '@/api/accounts';
import { fetchChainHight } from '@/api/blocks';
import { fetchMosaicInfo } from '@/api/mosaics';
import { fetchMosaicMetadataPage } from '@/api/mosaicMetadata';
import { fetchMosaicArtifactExpiryReceiptPage, fetchMosaicReceiptPage } from '@/api/mosaicReceipts';
import { fetchMosaicRestrictionPage } from '@/api/mosaicRestrictions';
import { fetchTransactionPage } from '@/api/transactions';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemTransactionMobile from '@/components/ItemTransactionMobile';
import Progress from '@/components/Progress';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueList from '@/components/ValueList';
import ValueMosaic from '@/components/ValueMosaic';
import ValueMosaicAliases from '@/components/ValueMosaicAliases';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import styles from '@/styles/pages/MosaicInfo.module.scss';
import { createPageHref, nullableValueToText, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';

const MOSAIC_ADDRESS_RESTRICTION_TYPE = 0;
const MOSAIC_GLOBAL_RESTRICTION_TYPE = 1;

export const getServerSideProps = async ({ locale, params }) => {
	const mosaicInfo = await fetchMosaicInfo(params.id);

	if (!mosaicInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			mosaicInfo,
			preloadedTransactions: [],
			preloadedAccounts: [],
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const MosaicInfo = ({ mosaicInfo, preloadedTransactions, preloadedAccounts }) => {
	const { levy } = mosaicInfo;
	const { t } = useTranslation('common');
	const accountPagination = usePagination(fetchAccountPage, preloadedAccounts, {
		mosaic: mosaicInfo.id,
		mosaicDivisibility: mosaicInfo.divisibility
	});
	const transactionPagination = usePagination(fetchTransactionPage, preloadedTransactions, {
		mosaic: mosaicInfo.id,
		mosaicDivisibility: mosaicInfo.divisibility
	});
	const globalRestrictionPagination = usePagination(fetchMosaicRestrictionPage, [], {
		mosaicId: mosaicInfo.id,
		type: MOSAIC_GLOBAL_RESTRICTION_TYPE
	});
	const addressRestrictionPagination = usePagination(fetchMosaicRestrictionPage, [], {
		mosaicId: mosaicInfo.id,
		type: MOSAIC_ADDRESS_RESTRICTION_TYPE
	});
	const metadataPagination = usePagination(fetchMosaicMetadataPage, [], { targetId: mosaicInfo.id });
	const receiptPagination = usePagination(fetchMosaicReceiptPage, [], { height: mosaicInfo.registrationHeight });
	const artifactExpiryHeight = mosaicInfo.namespaceExpirationHeight || mosaicInfo.expirationHeight;
	const artifactExpiryPagination = usePagination(fetchMosaicArtifactExpiryReceiptPage, [], { height: artifactExpiryHeight });
	const [chainHeight, setChainHeight] = useState(0);
	const [expirationText, setExpirationText] = useState(null);
	const [progressType, setProgressType] = useState('');
	const mosaicFlagLabels = [
		{ key: 'isTransferable', label: t('label_transferable') },
		{ key: 'isSupplyMutable', label: t('label_supplyMutable') },
		{ key: 'isRestrictable', label: t('label_restrictable') },
		{ key: 'isRevokable', label: t('label_revokable') }
	].filter((_, index) => pageConfig.mosaics.showFlags || index < 2);
	const isExpirationProgressShown = !mosaicInfo.isUnlimitedDuration || pageConfig.mosaics.showUnlimitedExpirationProgress;
	const progressRegistrationHeight = pageConfig.mosaics.showRegistrationHeightDetail
		? mosaicInfo.namespaceRegistrationHeight
		: mosaicInfo.registrationHeight;
	const progressExpirationHeight = mosaicInfo.isUnlimitedDuration ? Infinity : mosaicInfo.namespaceExpirationHeight;
	const progressExpirationHeightText = mosaicInfo.isUnlimitedDuration ? 'Infinity' : mosaicInfo.namespaceExpirationHeight;

	const accountsTableColumns = [
		{
			key: 'address',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'balance',
			size: '20rem',
			renderValue: value => <ValueMosaic amount={value} mosaicId={mosaicInfo.id} mosaicName={mosaicInfo.name} />
		}
	];
	const transactionTableColumns = [
		{
			key: 'hash',
			size: '8rem',
			renderValue: value => <ValueTransactionHash value={value} />
		},
		{
			key: 'type',
			size: '9rem',
			renderValue: value => <ValueTransactionType value={value} />
		},
		{
			key: 'sender',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'recipient',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'value',
			size: '20rem',
			renderValue: value => (
				<ValueList
					data={value}
					max={2}
					direction="column"
					renderItem={item => <ValueMosaic mosaicId={item.id} mosaicName={item.name} amount={item.amount} isTickerShown />}
				/>
			)
		},
		{
			key: 'timestamp',
			size: '10rem',
			renderTitle: () => <FieldTimestamp />,
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
	];
	const globalRestrictionTableColumns = [
		{
			key: 'compositeHash',
			size: '30rem',
			renderValue: value => <ValueCopy value={value} />
		},
		{
			key: 'entryType',
			size: '18rem',
			renderTitle: () => t('table_field_entryType')
		},
		{
			key: 'restrictions',
			size: '36rem',
			renderTitle: () => t('table_field_restrictionsAllowIf'),
			renderValue: value => <span className={styles.restrictionValue}>{value}</span>
		}
	];
	const addressRestrictionTableColumns = [
		{
			key: 'compositeHash',
			size: '30rem',
			renderValue: value => <ValueCopy value={value} />
		},
		{
			key: 'entryType',
			size: '18rem',
			renderTitle: () => t('table_field_entryType')
		},
		{
			key: 'targetAddress',
			size: '28rem',
			renderTitle: () => t('table_field_targetAddress'),
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'restrictions',
			size: '22rem',
			renderTitle: () => t('table_field_restrictionsAllowIf')
		}
	];
	const metadataTableColumns = [
		{
			key: 'scopedMetadataKey',
			size: '20rem',
			renderTitle: () => t('table_field_scopedMetadataKey'),
			renderValue: value => <span className={styles.metadataValue}>{nullableValueToText(value)}</span>
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
			renderTitle: () => t('table_field_value'),
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
	const artifactExpiryTableColumns = [
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
			key: 'artifactId',
			size: '30rem'
		}
	];

	useEffect(() => {
		const fetchChainHeight = async () => {
			const chainHeight = await fetchChainHight();
			const expireIn = mosaicInfo.namespaceExpirationHeight - chainHeight;
			const isExpired = expireIn < 0;
			const expirationText = mosaicInfo.isUnlimitedDuration
				? pageConfig.mosaics.showUnlimitedExpirationProgress
					? 'Infinity'
					: t('value_neverExpired')
				: isExpired
					? t('value_expired')
					: t('value_expiration', { value: expireIn });
			const progressType = isExpired ? 'danger' : '';
			setChainHeight(chainHeight);
			setExpirationText(expirationText);
			setProgressType(progressType);
		};
		fetchChainHeight();
		accountPagination.initialRequest();
		transactionPagination.initialRequest();
		if (pageConfig.mosaics.showRestrictionList) {
			globalRestrictionPagination.initialRequest();
			addressRestrictionPagination.initialRequest();
		}
		if (pageConfig.mosaics.showMetadataEntries)
			metadataPagination.initialRequest();
		if (pageConfig.mosaics.showBalanceTransferReceipt)
			receiptPagination.initialRequest();
		if (pageConfig.mosaics.showArtifactExpiryReceipt && artifactExpiryHeight)
			artifactExpiryPagination.initialRequest();
	}, [mosaicInfo]);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_mosaicInfo', { name: mosaicInfo.name })}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_mosaic')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="mosaic" value={mosaicInfo.id} size="xl" />
						<Field title={t(pageConfig.mosaics.nameColumnTitleKey || 'field_name')}>
							<div className="value-highlighted">{mosaicInfo.name}</div>
						</Field>
						{pageConfig.mosaics.showAlias && (
							<Field title={t('table_field_alias')}>
								<ValueMosaicAliases aliases={mosaicInfo.aliasNames} />
							</Field>
						)}
						{pageConfig.mosaics.showCreated && (
							<FieldTimestamp title={t('field_created')} value={mosaicInfo.registrationTimestamp} hasTime />
						)}
						<div className="layout-flex-row-stacked">
							{mosaicFlagLabels.map(item => (
								<ValueLabel
									key={item.key}
									type={mosaicInfo[item.key] ? 'true' : 'false'}
									text={item.label}
								/>
							))}
						</div>
						{pageConfig.mosaics.showCreated && (
							<div className="value-description">{mosaicInfo.description || 'No description'}</div>
						)}
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						{pageConfig.mosaics.showNamespaceDetail && (
							<Field title={t('field_mosaic_namespace')} description={t('field_mosaic_namespace_description')}>
								<Link href={createPageHref('namespaces', mosaicInfo.rootNamespaceName)}>{mosaicInfo.namespaceName}</Link>
							</Field>
						)}
						<Field title={t('field_supply')} description={t('field_supply_description')}>
							{mosaicInfo.supply}
						</Field>
						<Field title={t('field_divisibility')} description={t('field_divisibility_description')}>
							{mosaicInfo.divisibility}
						</Field>
						<Field title={t('field_creator')}>
							<ValueAccount address={mosaicInfo.creator} size="sm" />
						</Field>
						{pageConfig.mosaics.showRegistrationHeightDetail && (
							<Field title={t('field_registrationHeight')} description={t('field_mosaicRegistrationHeight_description')}>
								<Link href={createPageHref('blocks', mosaicInfo.registrationHeight)}>{mosaicInfo.registrationHeight}</Link>
							</Field>
						)}
						<Field title={t(pageConfig.mosaics.showNamespaceDetail ? 'field_namespaceExpiration' : 'field_expiration')} description={t('field_mosaicNamespaceExpiration_description')}>
							{nullableValueToText(expirationText)}
						</Field>
						{isExpirationProgressShown && (
							<Progress
								titleLeft={t(pageConfig.mosaics.showNamespaceDetail ? 'field_namespaceRegistrationHeight' : 'field_registrationHeight')}
								titleRight={t(pageConfig.mosaics.showNamespaceDetail ? 'field_namespaceExpirationHeight' : 'field_expirationHeight')}
								valueLeft={progressRegistrationHeight}
								valueRight={progressExpirationHeight}
								valueRightText={progressExpirationHeightText}
								value={chainHeight}
								type={progressType}
							/>
						)}
					</div>
				</Section>
			</div>
			{!!levy && (
				<Section title={t('section_associatedData')} cardClassName={styles.stateSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_levyType')} description={t('field_levyType_description')}>
							{levy.type}
						</Field>
						<Field title={t('field_levyMosaic')} description={t('field_levyMosaic_description')}>
							<ValueCopy value={levy.mosaic} />
						</Field>
						<Field title={t('field_levyFee')}>{levy.fee}</Field>
						<Field title={t('field_levyRecipient')} description={t('field_levyRecipient_description')}>
							<ValueAccount address={levy.recipient} size="sm" />
						</Field>
					</div>
				</Section>
			)}
			{pageConfig.mosaics.showRestrictionList && (
				<Section
					title={t('section_mosaicRestrictionList')}
					tabs={[
						{
							label: t('tab_mosaicGlobalRestriction'),
							content: (
								<div className={styles.restrictionList}>
									<Table
										data={globalRestrictionPagination.data}
										columns={globalRestrictionTableColumns}
										isLoading={globalRestrictionPagination.isLoading}
										isLastPage={globalRestrictionPagination.isLastPage}
										isError={globalRestrictionPagination.isError}
										isHeaderSticky={false}
										onEndReached={globalRestrictionPagination.requestNextPage}
									/>
								</div>
							)
						},
						{
							label: t('tab_mosaicAddressRestriction'),
							content: (
								<div className={styles.restrictionList}>
									<Table
										data={addressRestrictionPagination.data}
										columns={addressRestrictionTableColumns}
										isLoading={addressRestrictionPagination.isLoading}
										isLastPage={addressRestrictionPagination.isLastPage}
										isError={addressRestrictionPagination.isError}
										isHeaderSticky={false}
										onEndReached={addressRestrictionPagination.requestNextPage}
									/>
								</div>
							)
						}
					]}
				/>
			)}
			{pageConfig.mosaics.showMetadataEntries && (
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
			{pageConfig.mosaics.showBalanceTransferReceipt && (
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
			{pageConfig.mosaics.showArtifactExpiryReceipt && !artifactExpiryPagination.isError && !!artifactExpiryPagination.data.length && (
				<Section title={t('section_artifactExpiryReceipt')}>
					<Table
						data={artifactExpiryPagination.data}
						columns={artifactExpiryTableColumns}
						isLoading={artifactExpiryPagination.isLoading}
						isError={artifactExpiryPagination.isError}
						isLastPage={artifactExpiryPagination.isLastPage}
						onEndReached={artifactExpiryPagination.requestNextPage}
						isHeaderSticky={false}
					/>
				</Section>
			)}
			<Section
				title={t('section_distribution')}
				tabs={[
					{
						label: t('section_holders'),
						content: (
							<Table
								data={accountPagination.data}
								columns={accountsTableColumns}
								isLoading={accountPagination.isLoading}
								isLastPage={accountPagination.isLastPage}
								isError={accountPagination.isError}
								onEndReached={accountPagination.requestNextPage}
							/>
						)
					},
					{
						label: t('section_transfers'),
						content: (
							<Table
								data={transactionPagination.data}
								columns={transactionTableColumns}
								renderItemMobile={data => <ItemTransactionMobile data={data} />}
								isLoading={transactionPagination.isLoading}
								isLastPage={transactionPagination.isLastPage}
								isError={transactionPagination.isError}
								isLastColumnAligned
								onEndReached={transactionPagination.requestNextPage}
							/>
						)
					}
				]}
			/>
		</div>
	);
};

export default MosaicInfo;
