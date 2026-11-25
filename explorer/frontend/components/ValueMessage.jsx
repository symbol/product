import ValueLabel from './ValueLabel';
import styles from '@/app/styles/components/ValueMessage.module.scss';
import { valueMessageConfig } from '@/variant/config/value-message-config';
import { useTranslation } from 'next-i18next';

const ValueMessage = ({ message }) => {
	const { t } = useTranslation();
	const labelLocaleKey = valueMessageConfig.labelLocaleKeys[message.type];

	return (
		<div>
			{!!labelLocaleKey && <ValueLabel className={styles.label} text={t(labelLocaleKey)} isIconHidden />}
			<span>{message.text}</span>
		</div>
	);
};

export default ValueMessage;
