import IconTransactionType from './IconTransactionType';
import styles from '@/styles/components/ValueTransactionType.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionType = ({ value, className, hideIcon }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${value}`);

	return (
		<div className={`${styles.valueTransactionType} ${className}`}>
			{!hideIcon && <IconTransactionType className={styles.icon} value={value} />}
			<div>{typeText}</div>
		</div>
	);
};

export default ValueTransactionType;
