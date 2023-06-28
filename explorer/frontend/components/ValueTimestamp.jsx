import { useTranslation } from 'next-i18next';
import { formatDate } from '../utils';

const ValueTimestamp = ({ value, hasTime, hasSeconds }) => {
	const { t } = useTranslation('common');
    const formattedDate = formatDate(value, t, hasTime, hasSeconds);

	return <div>{formattedDate}</div>;
}

export default ValueTimestamp;
