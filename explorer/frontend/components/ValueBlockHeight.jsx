import Link from 'next/link';

const ValueBlockHeight = ({ value, className }) => (
	<Link className={className} href={`/blocks/${value}`}>
		{value}
	</Link>
);

export default ValueBlockHeight;
