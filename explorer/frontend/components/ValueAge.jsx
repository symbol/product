import dynamic from 'next/dynamic';

const ReactTimeAgo = dynamic(
	() => import('react-time-ago'),
	{ ssr: false }
);

const ValueAge = ({ value, className }) => {
	return (<ReactTimeAgo date={value} className={className} locale="en-US"/>)
}

export default ValueAge;
