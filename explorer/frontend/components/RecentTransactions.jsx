import IconTransactionType from './IconTransactionType';
import ValueAge from './ValueAge';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueTransactionHash from './ValueTransactionHash';
import styles from '@/styles/components/RecentTransactions.module.scss';
import { useTranslation } from 'next-i18next';

const TransactionPreview = ({ type, group, hash, timestamp, deadline, amount }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${type}`);
	const isUnconfirmed = group === 'unconfirmed';

	return (
		<div className={styles.transactionPreview}>
			<IconTransactionType value={type} />
			<div className={styles.info}>
				<div className={styles.type}>{typeText}</div>
				<ValueTransactionHash value={hash} />
				{isUnconfirmed && (
					<span>
						~ <ValueAge value={deadline} />
					</span>
				)}
				{!isUnconfirmed && <ValueTimestamp value={timestamp} />}
			</div>
			<div className={styles.amount}>
				<ValueMosaic isNative amount={amount} />
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
					group={item.group}
					hash={item.hash}
					deadline={item.deadline}
					timestamp={item.timestamp}
					fee={item.fee}
					amount={item.amount}
					key={key}
				/>
			))}
		</div>
	);
};

export default RecentTransactions;
