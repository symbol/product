import styles from '@/styles/components/ItemBlockMobile.module.scss';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueAccount from './ValueAccount';
import Link from 'next/link';
import CustomImage from './CustomImage';


const ItemBlockMobile = ({ data }) => {
    const { height, harvester, timestamp, totalFee, transactionCount} = data;

	return (
		<div className={styles.itemBlockMobile}>
			<div className={styles.middle}>
				<Link href={`/blocks/${height}`} className={styles.height}>{height}</Link>
				<ValueAccount address={harvester} size="sm" />
				<ValueTimestamp value={timestamp} hasTime/>
			</div>
			<div className={styles.end}>
				<div className={styles.info}>
                    <div className={styles.counter}>
                        <CustomImage src="images/icon-transaction.svg" />
                        <div>{transactionCount}</div>
                    </div>
                </div>
				<ValueMosaic isNative amount={totalFee} />
			</div>
		</div>
	);
}

export default ItemBlockMobile;
