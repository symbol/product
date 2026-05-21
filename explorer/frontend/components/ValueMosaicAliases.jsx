import { createPageHref } from '@/utils';
import Link from 'next/link';

const ValueMosaicAliases = ({ aliases = [], className }) => {
	if (!aliases.length)
		return <span>N/A</span>;

	return (
		<span className={className}>
			{aliases.map((alias, index) => (
				<span key={alias}>
					{index > 0 && ', '}
					<Link href={createPageHref('namespaces', alias)}>{alias}</Link>
				</span>
			))}
		</span>
	);
};

export default ValueMosaicAliases;
