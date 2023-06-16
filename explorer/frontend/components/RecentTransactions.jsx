import styles from '@/styles/components/RecentTransactions.module.scss';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import { useTranslation } from 'next-i18next';

const iconTypeMap = {
	transfer: '/images/transaction/transfer.svg'
};

const TransactionPreview = ({ type, hash, timestamp, fee, amount }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${type}`);

	return (
		<div className={styles.transactionPreview}>
			<img src={iconTypeMap[type]} className={styles.icon} />
			<div className={styles.info}>
				<div className={styles.type}>{typeText}</div>
				<div className={styles.hash}>{hash}</div>
				<ValueTimestamp value={timestamp} />
			</div>
			<div className={styles.amount}>
				<ValueMosaic amount={amount} />
				<ValueMosaic amount={fee} />
			</div>
		</div>
	);
};

const RecentTransactions = ({ data }) => {
	return (
		<div className={styles.table}>
			{data.map((item, key) => (
				<TransactionPreview
					type={item.type}
					hash={item.hash}
					timestamp={item.timestamp}
					fee={item.fee}
					amount={item.amount}
					key={key}
				/>
			))}
		</div>
	)
}

export default RecentTransactions;
