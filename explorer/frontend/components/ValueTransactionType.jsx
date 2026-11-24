import IconTransactionType from './IconTransactionType';
import styles from '@/app/styles/components/ValueTransactionType.module.scss';
import { utils } from '@/app/variants/utils';
import { useTranslation } from 'next-i18next';

const ValueTransactionType = ({ value, className, hideIcon }) => {
	const { t, i18n } = useTranslation();
	const typeText = utils.transactions.getTransactionTypeLabel?.(value, i18n?.language) ?? t(`transactionType_${value}`);

	return (
		<div className={`${styles.valueTransactionType} ${className}`}>
			{!hideIcon && <IconTransactionType className={styles.icon} value={value} />}
			<div>{typeText}</div>
		</div>
	);
};

export default ValueTransactionType;
