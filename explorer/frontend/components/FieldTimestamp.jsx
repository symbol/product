import Field from './Field';
import ValueTimestamp from './ValueTimestamp';
import { STORAGE_KEY } from '@/app/constants';
import styles from '@/app/styles/components/FieldTimestamp.module.scss';
import { createAssetURL } from '@/app/utils';
import { useStorage } from '@/app/utils';
import { useTranslation } from 'next-i18next';

const FieldTimestamp = ({ value, title, hasTime, hasSeconds }) => {
	const { t } = useTranslation();
	const [type, setType] = useStorage(STORAGE_KEY.TIMESTAMP_TYPE);
	const titleText = title || t('field_timestamp');
	let finalTitle;
	let iconSrc;
	let nextType;

	switch (type) {
	case 'local':
		finalTitle = t('field_timestampLocal', { title: titleText });
		nextType = 'UTC';
		iconSrc = createAssetURL('/images/icon-switch-2.svg');
		break;
	case 'UTC':
	default:
		finalTitle = t('field_timestampUTC', { title: titleText });
		nextType = 'local';
		iconSrc = createAssetURL('/images/icon-switch.svg');
		break;
	}

	const switchType = () => {
		setType(nextType);
	};

	return (
		<Field titleClassName={styles.fieldTimestamp} title={finalTitle} iconSrc={iconSrc} onTitleClick={switchType}>
			{!!value && <ValueTimestamp value={value} hasTime={hasTime} hasSeconds={hasSeconds} />}
		</Field>
	);
};

export default FieldTimestamp;
