import { fetchPriceByDate } from '@/api/stats';
import { fetchTransactionInfo } from '@/api/transactions';
import Avatar from '@/components/Avatar';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import Section from '@/components/Section';
import Table from '@/components/Table';
import TransactionGraphic, { getTransactionGraphicDetailFieldKeys } from '@/components/TransactionGraphic';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueList from '@/components/ValueList';
import ValueMosaic from '@/components/ValueMosaic';
import ValueNamespace from '@/components/ValueNamespace';
import ValueTransactionMessage from '@/components/ValueTransactionMessage';
import ValueTransactionType from '@/components/ValueTransactionType';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/pages/TransactionInfo.module.scss';
import { nullableValueToText, numberToShortString, truncateDecimals, useStorage, useUserCurrencyAmount } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const getTransactionHashPattern = () => {
	const pattern = pageConfig.transactions?.transactionHashPattern;

	return pattern ? new RegExp(pattern) : null;
};

export const getServerSideProps = async ({ locale, params }) => {
	const hash = `${params.hash || ''}`.trim();
	const transactionHashPattern = getTransactionHashPattern();

	if (transactionHashPattern && !transactionHashPattern.test(hash)) {
		return {
			notFound: true
		};
	}

	const transactionInfo = await fetchTransactionInfo(hash);

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

const renderPrimitiveValue = value => {
	if (value === null || value === undefined || value === '')
		return nullableValueToText(value);

	if (typeof value === 'boolean')
		return value ? 'true' : 'false';

	return `${value}`;
};

const FieldValue = ({ fieldKey, value }) => {
	const { t } = useTranslation();

	if (fieldKey === 'transactionType')
		return <ValueTransactionType value={value} />;

	if (fieldKey === 'hashAlgorithm')
		return t(`secretLockHashAlgorithm_${value}`);

	if (fieldKey === 'message')
		return value?.type === 'plain' ? renderPrimitiveValue(value.text) : <ValueTransactionMessage message={value} />;

	if (['signer', 'recipient', 'address', 'targetAddress', 'ownerAddress', 'linkedAccountAddress'].includes(fieldKey))
		return <ValueAccount address={value} size="sm" />;

	if (['blockHeight', 'startHeight', 'endHeight'].includes(fieldKey))
		return value ? <ValueBlockHeight value={value} /> : nullableValueToText(value);

	if (['timestamp', 'deadline'].includes(fieldKey))
		return <FieldTimestamp value={value} hasTime />;

	if (['mosaicId', 'targetMosaicId', 'referenceMosaicId'].includes(fieldKey))
		return <ValueMosaic mosaicId={value} mosaicName={value} />;

	if (['namespaceId', 'parentId', 'targetNamespaceId'].includes(fieldKey))
		return <ValueNamespace namespaceId={value} namespaceName={value} />;

	if (fieldKey === 'mosaics')
	{return (
		<ValueList
			data={value || []}
			direction="column"
			max={10}
			renderItem={item => (
				<ValueMosaic
					mosaicId={item.mosaicId || item.id}
					mosaicName={item.name || item.mosaicId || item.id}
					amount={item.amount}
					isTickerShown
				/>
			)}
		/>
	);}

	if (Array.isArray(value))
	{return (
		<ValueList
			data={value}
			direction="column"
			max={10}
			renderItem={item => (typeof item === 'string' ? <FieldValue fieldKey={fieldKey} value={item} /> : JSON.stringify(item))}
		/>
	);}

	if (typeof value === 'object')
		return <ValueCopy value={JSON.stringify(value)} />;

	if (['transactionHash', 'signature', 'hash', 'secret', 'proof', 'linkedPublicKey'].includes(fieldKey))
		return <ValueCopy value={value} />;

	return renderPrimitiveValue(value);
};

const DetailFields = ({ fields }) => {
	const { t } = useTranslation();

	return (
		<div className="layout-flex-col-fields">
			{Object.entries(fields).map(([key, value]) => (
				<Field title={t(`field_${key}`)} key={key}>
					<FieldValue fieldKey={key} value={value} />
				</Field>
			))}
		</div>
	);
};

const AggregateDetailFields = ({ fields }) => {
	const { transactionType, ...otherFields } = fields;
	const hasOtherFields = !!Object.keys(otherFields).length;

	return (
		<div className="layout-flex-col-fields">
			{!!transactionType && <ValueTransactionType className={styles.aggregateTransactionType} value={transactionType} />}
			{hasOtherFields && <DetailFields fields={otherFields} />}
		</div>
	);
};

const omitGraphicDetailFields = (detail, graphicTransactions = []) => {
	const omittedKeys = graphicTransactions.reduce((keys, transaction) => {
		getTransactionGraphicDetailFieldKeys(transaction).forEach(key => keys.add(key));
		return keys;
	}, new Set());

	return Object.entries(detail).reduce((fields, [key, value]) => {
		if (!omittedKeys.has(key))
			fields[key] = value;

		return fields;
	}, {});
};

const TransactionInfoFields = ({ transactionInfo }) => {
	const { info } = transactionInfo;
	const { t } = useTranslation();

	return (
		<div className="layout-flex-col-fields">
			<Avatar type="transaction" value={transactionInfo.type} size="lg" />
			<Field title={t('field_type')}>
				<ValueTransactionType hideIcon className="value-highlighted" value={transactionInfo.type} />
			</Field>
			<div className="layout-grid-row">
				<Field title={t('field_status')}>
					{transactionInfo.group === 'confirmed' && <ValueLabel text={t('label_confirmed')} type="confirmed" />}
					{transactionInfo.group === 'unconfirmed' && <ValueLabel text={t('label_unconfirmed')} type="pending" />}
					{transactionInfo.group === 'partial' && <ValueLabel text={t('label_partial')} type="pending" />}
					{!['confirmed', 'unconfirmed', 'partial'].includes(transactionInfo.group) && renderPrimitiveValue(info.confirm)}
				</Field>
				<FieldTimestamp value={info.timestamp} hasTime />
			</div>
			{info.effectiveFee !== undefined && info.effectiveFee !== null && (
				<Field title={t('field_effectiveFee')}>
					<ValueMosaic isNative amount={info.effectiveFee} />
				</Field>
			)}
			{info.maxFee !== undefined && info.maxFee !== null && (
				<Field title={t('field_maxFee')}>
					<ValueMosaic isNative amount={info.maxFee} />
				</Field>
			)}
			{!!info.status && <Field title={t('field_statusCode')}>{info.status}</Field>}
		</div>
	);
};

const TransactionMetadataFields = ({ transactionInfo }) => {
	const { info } = transactionInfo;
	const { t } = useTranslation();

	return (
		<div className="layout-flex-col-fields">
			<Field title={t('field_transaction_hash')} description={t('field_transaction_hash_description')}>
				<ValueCopy value={info.transactionHash} />
			</Field>
			<Field title={t('field_signer')}>
				<ValueAccount address={info.signer} size="sm" />
			</Field>
			<Field title={t('field_transaction_block')} description={t('field_transaction_block_description')}>
				{info.blockHeight ? <ValueBlockHeight value={info.blockHeight} /> : nullableValueToText(info.blockHeight)}
			</Field>
			<Field title={t('field_deadline')}>
				<FieldTimestamp value={info.deadline} hasTime />
			</Field>
			<Field title={t('field_size')}>{nullableValueToText(info.payloadSize)} B</Field>
			<Field title={t('field_version')}>{nullableValueToText(info.version)}</Field>
			<Field title={t('field_signature')}>
				<ValueCopy value={info.signature} />
			</Field>
		</div>
	);
};

const TransactionInfo = ({ transactionInfo }) => {
	const { t } = useTranslation();

	if (!transactionInfo.info)
		return <LegacyTransactionInfo transactionInfo={transactionInfo} />;

	const { aggregate, hashLock } = transactionInfo;
	const graphicTransactions = transactionInfo.graphic?.transactions || [];
	const visibleDetailFieldsBase = omitGraphicDetailFields(transactionInfo.detail || {}, graphicTransactions);
	const aggregateTransactionTypes = pageConfig.transactions?.aggregateTransactionTypes || [];
	const isAggregateTransaction = aggregateTransactionTypes.includes(transactionInfo.type) || !!aggregate;
	const visibleDetailFields = isAggregateTransaction && transactionInfo.detail?.transactionType
		? { transactionType: transactionInfo.detail.transactionType, ...visibleDetailFieldsBase }
		: visibleDetailFieldsBase;
	const hasVisibleDetailFields = !!Object.keys(visibleDetailFields).length;
	const cosignatureColumns = [
		{
			key: 'signer',
			size: '36rem',
			renderValue: value => <ValueAccount address={value} size="sm" raw isAddressTruncated={false} />
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
				<Section title={t('section_transactionInfo')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<TransactionInfoFields transactionInfo={transactionInfo} />
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<TransactionMetadataFields transactionInfo={transactionInfo} />
				</Section>
			</div>
			<Section title={t('section_transactionDetail')}>
				{isAggregateTransaction ? (
					<div className={styles.aggregateTransactionDetailContent}>
						{hasVisibleDetailFields && <AggregateDetailFields fields={visibleDetailFields} />}
						<div className={styles.aggregateInnerTransactionsLabel}>{t('section_innerTransactions')}</div>
						<TransactionGraphic transactions={graphicTransactions} />
					</div>
				) : (
					<div className={styles.transactionDetailContent}>
						<div className={hasVisibleDetailFields ? styles.transactionGraphicPanel : styles.transactionGraphicPanelFull}>
							<TransactionGraphic transactions={graphicTransactions} />
						</div>
						{hasVisibleDetailFields && (
							<div className={styles.transactionDetailFields}>
								<DetailFields fields={visibleDetailFields} />
							</div>
						)}
					</div>
				)}
			</Section>
			{!!hashLock && (
				<Section title={t('section_hashLock')}>
					<DetailFields fields={hashLock} />
				</Section>
			)}
			{!!aggregate?.cosignatures?.length && (
				<Section title={t('section_aggregateCosignatures')}>
					<Table data={aggregate.cosignatures} columns={cosignatureColumns} isLastPage isColumnsStacked />
				</Section>
			)}
		</div>
	);
};

const LegacyTransactionInfo = ({ transactionInfo }) => {
	const { t } = useTranslation();
	const [userCurrency] = useStorage(STORAGE_KEY.USER_CURRENCY, 'USD');
	const amountInUserCurrency = useUserCurrencyAmount(fetchPriceByDate, transactionInfo.amount, userCurrency, transactionInfo.timestamp);
	const amountInUserCurrencyText = numberToShortString(truncateDecimals(amountInUserCurrency, 2));
	const isAccountStateChangeSectionShown =
		transactionInfo.type === TRANSACTION_TYPE.TRANSFER || transactionInfo.type === TRANSACTION_TYPE.MULTISIG;
	const isSignaturesSectionShown = transactionInfo.type === TRANSACTION_TYPE.MULTISIG;
	const isFeesBreakdownSectionShown = transactionInfo.type === TRANSACTION_TYPE.MULTISIG;
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
			size: '15rem',
			renderValue: (value, row) => (
				<>
					{value.map((mosaic, index) => (
						<ValueMosaic
							mosaicId={mosaic.id}
							mosaicName={mosaic.name}
							amount={Math.abs(mosaic.amount)}
							direction={row.action[index]}
							key={'mosaic' + index}
							isTickerShown
						/>
					))}
				</>
			)
		}
	];
	const signaturesTableColumns = [
		{
			key: 'signer',
			size: '29rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'signature',
			size: '40rem',
			renderValue: value => <ValueCopy value={value} />
		}
	];
	const feesBreakdownTableColumns = [
		{
			key: 'type',
			size: '29rem',
			renderValue: value => value === 'totalFee'
				? <strong>{t(`field_${value}`)}</strong>
				: t(`field_${value}`)
		},
		{
			key: 'amount',
			size: '10rem',
			renderValue: value => <ValueMosaic amount={value} isNative />
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
									<div>~{amountInUserCurrencyText}</div>
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
							<ValueBlockHeight value={nullableValueToText(transactionInfo.height)} />
						</Field>
						<Field title={t('field_size')}>{nullableValueToText(transactionInfo.size)} B</Field>
						<Field title={t('field_version')}>{nullableValueToText(transactionInfo.version)}</Field>
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
					<Table data={transactionInfo.accountStateChange} columns={accountStateTableColumns} isLastPage />
				</Section>
			)}
			{isSignaturesSectionShown && (
				<Section title={t('section_signatures')}>
					<Table data={transactionInfo.signatures} columns={signaturesTableColumns} isLastPage isColumnsStacked />
				</Section>
			)}
			{isFeesBreakdownSectionShown && (
				<Section title={t('section_feesBreakdown')}>
					<Table
						data={transactionInfo.feesBreakdown}
						columns={feesBreakdownTableColumns}
						isLastPage
						isHeaderHidden
						isColumnsStacked
					/>
				</Section>
			)}
		</div>
	);
};

export default TransactionInfo;
