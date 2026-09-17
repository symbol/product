import Avatar from './Avatar';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/app/styles/components/ItemHarvestedBlockMobile.module.scss';
import { createPageHref } from '@/app/utils';
import Link from 'next/link';

const ItemHarvestedBlockMobile = ({ data }) => {
	const { height, timestamp, amount } = data;

	return (
		<Link className={styles.itemHarvestedBlockMobile} href={createPageHref('blocks', height)}>
			<Avatar type="block" size="md" value={height} />
			<div className={styles.info}>
				<div className={styles.name}>{height}</div>
				<div className="layout-flex-row">
					<ValueTimestamp value={timestamp} hasTime />
					<ValueMosaic isNative amount={amount} />
				</div>
			</div>
		</Link>
	);
};

export default ItemHarvestedBlockMobile;
