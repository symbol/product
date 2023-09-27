import { createPageHref } from '@/utils';
import CustomImage from './CustomImage';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ValueBlockHeight.module.scss';
import Link from 'next/link';

const ValueBlockHeight = ({ value, timestamp, className, size, isNavigationDisabled, onClick }) => {
	const handleClick = e => {
		e.stopPropagation();
		if (!onClick) return;
		if (isNavigationDisabled) e.preventDefault();
		onClick(value);
	};

	return size === 'md' ? (
		<Link className={styles.valueBlockHeight} href={createPageHref('blocks', value)} onClick={handleClick}>
			<CustomImage className={styles.icon} src="/images/icon-transaction-header-block.svg" alt="Block" />
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
