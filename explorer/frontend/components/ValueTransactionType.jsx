import IconTransactionType from './IconTransactionType';
import styles from '@/styles/components/ValueTransactionType.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionType = ({ value, className, hideIcon, onClick }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${value}`);

	const handleClick = () => onClick && onClick(value);

	return (
		<div className={`${styles.valueTransactionType} ${className}`} onClick={handleClick}>
			{!hideIcon && <IconTransactionType value={value} />}
			<div>{typeText}</div>
		</div>
	);
};

export default ValueTransactionType;
