import CustomImage from './CustomImage';
import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemBlockMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';

const ItemBlockMobile = ({ data }) => {
	const { height, harvester, timestamp, totalFee, transactionCount } = data;

	return (
		<div className={styles.itemBlockMobile}>
			<div className={styles.middle}>
				<Link href={createPageHref('blocks', height)} className={styles.height}>
					{height}
				</Link>
				<div className={styles.row}>
					<ValueAccount address={harvester} size="sm" />
					<div className={styles.counter}>
						<CustomImage className={styles.counterImage} src="/images/icon-transaction.svg" />
						<div>{transactionCount}</div>
					</div>
				</div>
				<div className={styles.row}>
					<ValueTimestamp value={timestamp} hasTime />
					<ValueMosaic isNative amount={totalFee} />
				</div>
			</div>
		</div>
	);
};

export default ItemBlockMobile;
