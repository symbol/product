import { useTranslation } from 'next-i18next';
import styles from '@/styles/components/ValueTransactionDirection.module.scss';

const ValueTransactionDirection = ({ value }) => {
	const { t } = useTranslation();
	const isIncoming = value === 'incoming';
	const isOutgoing = value === 'outgoing';

	if (!isIncoming && !isOutgoing) return null;

	const style = styles[value];
	const text = t(`label_${value}`);

	return (
		<div className={styles.transactionDirection}>
			<div className={style}>{text}</div>
		</div>
	);
};

export default ValueTransactionDirection;
