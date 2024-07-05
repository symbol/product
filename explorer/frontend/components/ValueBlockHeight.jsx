import Avatar from './Avatar';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ValueBlockHeight.module.scss';
import { createPageHref, handleNavigationItemClick } from '@/utils';
import Link from 'next/link';

const ValueBlockHeight = ({ value, timestamp, className, size, isNavigationDisabled, onClick }) => {
	const handleClick = e => {
		handleNavigationItemClick(e, onClick, value, isNavigationDisabled);
	};

	return size === 'md' ? (
		<Link className={styles.valueBlockHeight} href={createPageHref('blocks', value)} onClick={handleClick}>
			<Avatar type="block" size="md" />
			<div>
				<div className={styles.title}>{value}</div>
				{!!timestamp && <ValueTimestamp value={timestamp} hasTime />}
			</div>
		</Link>
	) : (
		<Link className={className} href={createPageHref('blocks', value)} onClick={handleClick}>
			{value}
		</Link>
	);
};

export default ValueBlockHeight;
