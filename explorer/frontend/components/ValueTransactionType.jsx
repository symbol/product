import IconTransactionType from './IconTransactionType';
import styles from '@/app/styles/components/ValueTransactionType.module.scss';
import { getTransactionTypeInfo } from '@/variant/transaction/transaction-types';
import { useTranslation } from 'next-i18next';

const ValueTransactionType = ({ value, className, hideIcon }) => {
	const { t } = useTranslation();
	const typeText = t(getTransactionTypeInfo(value).localeKey);

	return (
		<div className={`${styles.valueTransactionType} ${className}`}>
			{!hideIcon && <IconTransactionType className={styles.icon} value={value} />}
			<div>{typeText}</div>
		</div>
	);
};

export default ValueTransactionType;
