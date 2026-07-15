import CustomImage from './CustomImage';
import IconTransactionType from './IconTransactionType';
import ValueAge from './ValueAge';
import ValueMosaic from './ValueMosaic';
import ValueTransactionHash from './ValueTransactionHash';
import styles from '@/app/styles/components/RecentTransactions.module.scss';
import { createAssetURL } from '@/app/utils';
import { utils } from '@/app/variants/utils';
import { useTranslation } from 'next-i18next';

const TransactionPreview = ({ type, group, signer, hash, timestamp, amount, blockTime }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${type}`);
	const labelSenderText = t('table_field_sender');
	const isUnconfirmed = ['unconfirmed', 'partial'].includes(group);
	const isAwaitingSignatures = utils.transactions.isTransactionAwaitingSignatures({ type, group });
	const title = `${typeText}\n${labelSenderText}: ${signer}`;

	return (
		<div className={styles.transactionPreview} title={title}>
			{isUnconfirmed && (
				<CustomImage src={createAssetURL('/images/transaction/pending.svg')} alt="Unconfirmed" className={styles.icon} />
			)}
			{!isUnconfirmed && <IconTransactionType value={type} />}
			<div className={styles.info}>
				<div className={styles.type}>{typeText}</div>
				{!!hash && <ValueTransactionHash value={hash} />}
				{isUnconfirmed && !isAwaitingSignatures && (
					<span>{t('value_transactionConfirmationTime', { value: blockTime })}</span>
				)}
				{isAwaitingSignatures && <span>{t('label_awaitingCosignatures')}</span>}
				{!isUnconfirmed && <ValueAge value={timestamp} />}
			</div>
			<div className={styles.amount}>
				<ValueMosaic isNative amount={amount} />
			</div>
		</div>
	);
};

const RecentTransactions = ({ data, blockTime }) => {
	const { t } = useTranslation('common');

	return (
		<div className={styles.table}>
			{data.map((item, key) => (
				<TransactionPreview
					type={item.type}
					signer={item.signer}
					group={item.group}
					hash={item.hash}
					deadline={item.deadline}
					timestamp={item.timestamp}
					fee={item.fee}
					amount={item.amount}
					blockTime={blockTime}
					key={key}
				/>
			))}
			{data.length === 0 && <div className={styles.emptyListMessage}>{t('message_emptyTable')}</div>}
		</div>
	);
};

export default RecentTransactions;
