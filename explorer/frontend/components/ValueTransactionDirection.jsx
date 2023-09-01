import { TRANSACTION_DIRECTION } from '@/constants';
import styles from '@/styles/components/ValueTransactionDirection.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionDirection = ({ value }) => {
	const { t } = useTranslation();
	const isIncoming = value === TRANSACTION_DIRECTION.INCOMING;
	const isOutgoing = value === TRANSACTION_DIRECTION.OUTGOING;
	const styleMap = {
		[TRANSACTION_DIRECTION.INCOMING]: styles.incoming,
		[TRANSACTION_DIRECTION.OUTGOING]: styles.outgoing
	};

	if (!isIncoming && !isOutgoing) return null;

	const style = styleMap[value];
	const text = t(`label_${value}`);

	return (
		<div className={styles.transactionDirection}>
			<div className={style}>{text}</div>
		</div>
	);
};

export default ValueTransactionDirection;
