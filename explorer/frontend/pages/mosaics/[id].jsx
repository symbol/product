import { fetchBlockPage } from '../api/blocks';
import { getMosaicInfo } from '../api/mosaic';
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
import ValueMosaic from '@/components/ValueMosaic';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionType from '@/components/ValueTransactionType';
import { fetchTransactionPage, getTransactionPage } from '@/pages/api/transactions';
import styles from '@/styles/pages/MosaicInfo.module.scss';
import { usePagination } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';

export const getServerSideProps = async ({ locale, params }) => {
	const mosaicInfo = await getMosaicInfo(params.id);
	const transactionsPage = await getTransactionPage({ mosaic: params.id });

	if (!mosaicInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			mosaicInfo,
			preloadedTransactions: transactionsPage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const MosaicInfo = ({ mosaicInfo, preloadedTransactions }) => {
	const { levy } = mosaicInfo;
	const { t } = useTranslation();
	const transactionPagination = usePagination(fetchTransactionPage, preloadedTransactions);
	const [chainHeight, setChainHeight] = useState(0);
	const labelTransferable = {
		type: mosaicInfo.isTransferable ? 'true' : 'false',
		text: t('label_transferable')
	};
	const labelSupplyMutable = {
		type: mosaicInfo.isSupplyMutable ? 'true' : 'false',
		text: t('label_supplyMutable')
	};

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
			key: 'signer',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'recipient',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'amount',
			size: '10rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'fee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
		},
		{
			key: 'height',
			size: '6rem'
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
			const { data } = await fetchBlockPage();

			if (data[0]) {
				setChainHeight(data[0].height);
			}
		};
		fetchChainHeight();
	}, []);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_mosaicsInfo')}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_mosaic')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="mosaic" value={mosaicInfo.id} size="xl" />
						<Field title={t('field_name')}>
							<div className="value-highlighted">{mosaicInfo.name}</div>
						</Field>
						<Field title={t('field_id')}>
							<ValueCopy value={mosaicInfo.id} />
						</Field>
						<div className="layout-flex-row-stacked">
							<ValueLabel type={labelTransferable.type} text={labelTransferable.text} />
							<ValueLabel type={labelSupplyMutable.type} text={labelSupplyMutable.text} />
						</div>
						<div className="value-description">{mosaicInfo.description || 'No description'}</div>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_mosaic_names')} description={t('field_mosaic_names_description')}>
							{mosaicInfo.names.join(', ')}
						</Field>
						<Field title={t('field_supply')} description={t('field_supply_description')}>
							{mosaicInfo.supply}
						</Field>
						<Field title={t('field_divisibility')} description={t('field_divisibility_description')}>
							{mosaicInfo.divisibility}
						</Field>
						<Field title={t('field_mosaicCreator')}>
							<ValueAccount address={mosaicInfo.creator} size="sm" />
						</Field>
						<Field title={t('field_mosaicExpiration')} description={t('field_mosaicExpiration_description')}>
							{t('value_mosaicExpiration', { value: mosaicInfo.expireIn })}
						</Field>
						<Progress
							titleLeft={t('field_mosaicRegistrationHeight')}
							titleRight={t('field_mosaicExpirationHeight')}
							valueLeft={mosaicInfo.registrationHeight}
							valueRight={mosaicInfo.expirationHeight}
							value={chainHeight}
						/>
					</div>
				</Section>
			</div>
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
			<Section title={t('section_transactions')}>
				<Table
					data={transactionPagination.data}
					columns={transactionTableColumns}
					ItemMobile={ItemTransactionMobile}
					isLoading={transactionPagination.isLoading}
					isLastPage={transactionPagination.isLastPage}
					onEndReached={transactionPagination.requestNextPage}
				/>
			</Section>
		</div>
	);
};

export default MosaicInfo;
