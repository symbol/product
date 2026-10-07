import { dateToLocalDate } from '@/app/utils';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const ReactTimeAgo = dynamic(() => import('react-time-ago'), { ssr: false });

const TIMEZONE_DESIGNATOR_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

// Timezone-less date strings carry UTC time, but `new Date()` parses them as local time, so they need a correction.
const isUtcStringWithoutTimezone = value => 'string' === typeof value && !TIMEZONE_DESIGNATOR_REGEX.test(value);

const ValueAge = ({ value, className }) => {
	const router = useRouter();
	const date = isUtcStringWithoutTimezone(value) ? dateToLocalDate(value) : new Date(value);

	return <ReactTimeAgo date={date} className={className} locale={router.locale} timeStyle="round" />;
};

export default ValueAge;
