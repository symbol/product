import IconTransactionType from './IconTransactionType';
import styles from '@/styles/components/ValueTransactionType.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionType = ({ value }) => {
	const { t } = useTranslation();
	const typeText = t(`transactionType_${value}`);

	return (
		<div className={styles.valueTransactionType}>
			<IconTransactionType value={value} />
			<div>{typeText}</div>
		</div>
	);
};

export default ValueTransactionType;
