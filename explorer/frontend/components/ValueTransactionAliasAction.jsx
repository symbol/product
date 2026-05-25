import styles from '@/styles/components/ValueTransactionAliasAction.module.scss';
import { useTranslation } from 'next-i18next';

const ValueTransactionAliasAction = ({ action }) => {
	const { t } = useTranslation();

	if (!action)
		return null;

	const translationKey = action === 'link' ? 'value_keyLink' : 'value_keyUnlink';

	return <span className={styles.valueTransactionAliasAction}>{t(translationKey)}</span>;
};

export default ValueTransactionAliasAction;
