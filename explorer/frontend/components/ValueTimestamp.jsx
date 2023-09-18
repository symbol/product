import { formatDate, useStorage } from '../utils';
import { STORAGE_KEY } from '@/constants';
import { useTranslation } from 'next-i18next';

const ValueTimestamp = ({ value, hasTime, hasSeconds, hasDays }) => {
	const { t } = useTranslation('common');
	const [type] = useStorage(STORAGE_KEY.TIMESTAMP_TYPE);
	const formattedDate = formatDate(value, t, { type, hasTime, hasSeconds, hasDays });

	return <div>{formattedDate}</div>;
};

export default ValueTimestamp;
