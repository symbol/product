import { getPriceByDate } from '../api/stats';
import { getTransactionInfo } from '../api/transactions';
import Avatar from '@/components/Avatar';
import CustomImage from '@/components/CustomImage';
import Field from '@/components/Field';
import Section from '@/components/Section';
import Separator from '@/components/Separator';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionType from '@/components/ValueTransactionType';
import styles from '@/styles/pages/TransactionInfo.module.scss';
import { truncateDecimals } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import ValueBlockHeight from '@/components/ValueBlockHeight';

export const getServerSideProps = async ({ locale, params }) => {
	const transactionInfo = await getTransactionInfo(params.hash);

	if (!transactionInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			transactionInfo,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const TransactionInfo = ({ transactionInfo }) => {
	const { t } = useTranslation();
	const [amountUSD, setAmountUSD] = useState(null);

	const tableColumns = [
		{
			key: 'address',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'action',
			size: '10rem',
			renderValue: value => (
				<>
					{value.map((action, index) => (
						<div key={'action' + index}>{t(`label_${action}`)}</div>
					))}
				</>
			)
		},
		{
			key: 'mosaic',
			size: '30rem',
			renderValue: (value, row) => (
				<>
					{value.map((mosaic, index) => (
						<ValueMosaic
							mosaicId={mosaic.id}
							mosaicName={mosaic.name}
							amount={Math.abs(mosaic.amount)}
							direction={row.action[index]}
							key={'mosaic' + index}
						/>
					))}
				</>
			)
		}
	];

	useEffect(() => {
		const fetchAmountUSD = async () => {
			const price = await getPriceByDate(transactionInfo.timestamp);

			setAmountUSD(transactionInfo.amount * price);
		};

		if (transactionInfo.amount) {
			fetchAmountUSD();
		}
	}, [transactionInfo]);

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_transactionInfo')}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_transaction')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Avatar type="transaction" value={transactionInfo.type} size="lg" />
						<Field title={t('field_type')}>
							<ValueTransactionType hideIcon className="value-highlighted" value={transactionInfo.type} />
						</Field>
						<div className="layout-grid-row">
							<Field title={t('field_status')}>
								{transactionInfo.group === 'confirmed' && <ValueLabel text={t('label_confirmed')} type="confirmed" />}
								{transactionInfo.group === 'unconfirmed' && <ValueLabel text={t('label_unconfirmed')} type="pending" />}
							</Field>
							<Field title={t('field_timestamp')}>
								<ValueTimestamp value={transactionInfo.timestamp} hasTime />
							</Field>
						</div>
						{transactionInfo.amount && (
							<div className="layout-grid-row">
								<Field title={t('field_amount')}>
									<ValueMosaic isNative amount={transactionInfo.amount} />
								</Field>
								<Field title={t('field_amountUSD')}>
									<div>~${truncateDecimals(amountUSD, 2)}</div>
								</Field>
							</div>
						)}
						<Field title={t('field_fee')}>
							<ValueMosaic isNative amount={transactionInfo.fee} />
						</Field>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_transaction_hash')} description={t('field_transaction_hash_description')}>
							<ValueCopy value={transactionInfo.hash} />
						</Field>
						<Field title={t('field_sender')}>
							<ValueAccount address={transactionInfo.sender} size="sm" />
						</Field>
						<Field title={t('field_transaction_block')} description={t('field_transaction_block_description')}>
							<ValueBlockHeight value={transactionInfo.height} />
						</Field>
						<Field title={t('field_size')}>{transactionInfo.size} B</Field>
						<Field title={t('field_version')}>{transactionInfo.version}</Field>
						<Field title={t('field_signature')}>
							<ValueCopy value={transactionInfo.signature} />
						</Field>
					</div>
				</Section>
			</div>
			<Section title={t('section_accountStateChange')}>
				<Table data={transactionInfo.accountStateChange} columns={tableColumns} isLastPage={true} />
			</Section>
			<Section title={t('section_transactionBody')} cardClassName="layout-flex-col">
				{transactionInfo.body.map((item, index) => (
					<div className={`layout-flex-row-mobile-col ${styles.transactionGraphic}`} key={index}>
						<div className={styles.graphic}>
							<ValueAccount className={styles.accountLeft} address={item.sender} size="md" position="left" />
							<CustomImage src="/images/transaction-arrow.svg" className={styles.arrow} />
							<ValueTransactionType hideIcon className={styles.transactionType} value={item.type} />
							<ValueAccount className={styles.accountRight} address={item.recipient} size="md" position="right" />
						</div>
						<Separator />
						<div className={`layout-flex-col-fields ${styles.info}`}>
							<Field title={t('field_mosaics')}>
								{item.mosaics.map((mosaic, index) => (
									<ValueMosaic mosaicId={mosaic.id} amount={mosaic.amount} mosaicName={mosaic.name} key={index} />
								))}
							</Field>
							{item.message && <Field title={t('field_message')}>{item.message.text}</Field>}
						</div>
					</div>
				))}
			</Section>
		</div>
	);
};

export default TransactionInfo;
