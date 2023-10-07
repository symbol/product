import { fetchPriceByDate } from '@/api/stats';
import { fetchTransactionInfo } from '@/api/transactions';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import Section from '@/components/Section';
import Table from '@/components/Table';
import TransactionGraphic from '@/components/TransactionGraphic';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTransactionType from '@/components/ValueTransactionType';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/pages/TransactionInfo.module.scss';
import { truncateDecimals, useStorage, useUserCurrencyAmount } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale, params }) => {
	const transactionInfo = await fetchTransactionInfo(params.hash);

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
	const [userCurrency] = useStorage(STORAGE_KEY.USER_CURRENCY, 'USD');
	const amountInUserCurrency = useUserCurrencyAmount(fetchPriceByDate, transactionInfo.amount, userCurrency, transactionInfo.timestamp);
	const isAccountStateChangeSectionShown =
		transactionInfo.type === TRANSACTION_TYPE.TRANSFER || transactionInfo.type === TRANSACTION_TYPE.MULTISIG;
	const isSignaturesSectionShown = transactionInfo.type === TRANSACTION_TYPE.MULTISIG;

	const accountStateTableColumns = [
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

	const signaturesTableColumns = [
		{
			key: 'signer',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'signature',
			size: '40rem',
			renderValue: value => <ValueCopy value={value} />
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_transactionInfo', { type: transactionInfo.type })}</title>
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
							<FieldTimestamp value={transactionInfo.timestamp} hasTime />
						</div>
						{!!transactionInfo.amount && (
							<div className="layout-grid-row">
								<Field title={t('field_amount')}>
									<ValueMosaic isNative amount={transactionInfo.amount} />
								</Field>
								<Field title={t('field_amountInUserCurrency', { currency: userCurrency })}>
									<div>~{truncateDecimals(amountInUserCurrency, 2)}</div>
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
						<Field title={t('field_signer')}>
							<ValueAccount address={transactionInfo.signer} size="sm" />
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
			<Section title={t('section_transactionBody')}>
				<TransactionGraphic transactions={transactionInfo.body} />
			</Section>
			{isAccountStateChangeSectionShown && (
				<Section title={t('section_accountStateChange')}>
					<Table data={transactionInfo.accountStateChange} columns={accountStateTableColumns} isLastPage={true} />
				</Section>
			)}
			{isSignaturesSectionShown && (
				<Section title={t('section_signatures')}>
					<Table data={transactionInfo.signatures} columns={signaturesTableColumns} isLastPage={true} />
				</Section>
			)}
		</div>
	);
};

export default TransactionInfo;
