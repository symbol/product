import styles from '@/styles/components/ValueTransactionAliasAction.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionSupplyAction = ({ action }) => {
	const { t } = useTranslation();

	if (!action)
		return null;

	const translationKey = action === 'increase' ? 'value_supplyIncrease' : 'value_supplyDecrease';

	return <span className={styles.valueTransactionAliasAction}>{t(translationKey)}</span>;
};

export default ValueTransactionSupplyAction;
