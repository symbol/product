import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const ReactTimeAgo = dynamic(() => import('react-time-ago'), { ssr: false });

const ValueAge = ({ value, className }) => {
	const router = useRouter();

	return <ReactTimeAgo date={value} className={className} locale={router.locale} timeStyle="round" />;
};

export default ValueAge;
