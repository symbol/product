import { fetchAccountPage } from '@/api/accounts';
import { fetchChainHight } from '@/api/blocks';
import { fetchMosaicInfo } from '@/api/mosaics';
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
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import styles from '@/styles/pages/MosaicInfo.module.scss';
import { createPageHref, nullableValueToText, usePagination } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';

export const getServerSideProps = async ({ locale, params }) => {
	const mosaicInfo = await fetchMosaicInfo(params.id);
	const transactionsPage = await fetchTransactionPage({ mosaic: params.id });
	const accountsPage = await fetchAccountPage({ mosaic: params.id });

	if (!mosaicInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			mosaicInfo,
			preloadedTransactions: transactionsPage.data,
			preloadedAccounts: accountsPage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const MosaicInfo = ({ mosaicInfo, preloadedTransactions, preloadedAccounts }) => {
	const { levy } = mosaicInfo;
	const { t } = useTranslation();
	const accountPagination = usePagination(fetchAccountPage, preloadedAccounts, { mosaic: mosaicInfo.id });
	const transactionPagination = usePagination(fetchTransactionPage, preloadedTransactions, { mosaic: mosaicInfo.id });
	const [chainHeight, setChainHeight] = useState(0);
	const [expirationText, setExpirationText] = useState(null);
	const [progressType, setProgressType] = useState('');
	const labelTransferable = {
		type: mosaicInfo.isTransferable ? 'true' : 'false',
		text: t('label_transferable')
	};
	const labelSupplyMutable = {
		type: mosaicInfo.isSupplyMutable ? 'true' : 'false',
		text: t('label_supplyMutable')
	};
	const isExpirationShown = !mosaicInfo.isUnlimitedDuration;

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

	useEffect(() => {
		const fetchChainHeight = async () => {
			const chainHeight = await fetchChainHight();
			const expireIn = mosaicInfo.namespaceExpirationHeight - chainHeight;
			const isExpired = expireIn < 0;
			const expirationText = mosaicInfo.isUnlimitedDuration
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
						<Field title={t('field_name')}>
							<div className="value-highlighted">{mosaicInfo.name}</div>
						</Field>
						<FieldTimestamp title={t('field_created')} value={mosaicInfo.registrationTimestamp} hasTime />
						<div className="layout-flex-row-stacked">
							<ValueLabel type={labelTransferable.type} text={labelTransferable.text} />
							<ValueLabel type={labelSupplyMutable.type} text={labelSupplyMutable.text} />
						</div>
						<div className="value-description">{mosaicInfo.description || 'No description'}</div>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_mosaic_namespace')} description={t('field_mosaic_namespace_description')}>
							<Link href={createPageHref('namespaces', mosaicInfo.rootNamespaceName)}>{mosaicInfo.namespaceName}</Link>
						</Field>
						<Field title={t('field_supply')} description={t('field_supply_description')}>
							{mosaicInfo.supply}
						</Field>
						<Field title={t('field_divisibility')} description={t('field_divisibility_description')}>
							{mosaicInfo.divisibility}
						</Field>
						<Field title={t('field_creator')}>
							<ValueAccount address={mosaicInfo.creator} size="sm" />
						</Field>
						<Field title={t('field_registrationHeight')} description={t('field_mosaicRegistrationHeight_description')}>
							<Link href={createPageHref('blocks', mosaicInfo.registrationHeight)}>{mosaicInfo.registrationHeight}</Link>
						</Field>
						<Field title={t('field_namespaceExpiration')} description={t('field_mosaicNamespaceExpiration_description')}>
							{nullableValueToText(expirationText)}
						</Field>
						{isExpirationShown && (
							<Progress
								titleLeft={t('field_namespaceRegistrationHeight')}
								titleRight={t('field_namespaceExpirationHeight')}
								valueLeft={mosaicInfo.namespaceRegistrationHeight}
								valueRight={mosaicInfo.namespaceExpirationHeight}
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
