import CustomImage from './CustomImage';
import IconTransactionType from './IconTransactionType';
import ValueAccount from './ValueAccount';
import ValueList from './ValueList';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueTransactionHash from './ValueTransactionHash';
import styles from '@/styles/components/ItemTransactionMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemTransactionMobile = ({ data, isTimestampShown }) => {
	const { hash, sender, recipient, value, type, timestamp, direction } = data;
	const { t } = useTranslation();
	const typeText = t(`transactionType_${type}`);

	return (
		<Link className={styles.itemTransactionMobile} href={createPageHref('transactions', hash)}>
			<IconTransactionType value={type} />
			<div className={styles.middle}>
				<div className={styles.rowAmount}>
					<div>
						<div className={styles.type}>{typeText}</div>
						<div className={styles.row}>
							<CustomImage className={styles.iconDirection} src="/images/icon-hash.svg" />
							<ValueTransactionHash value={hash} />
						</div>
					</div>
					<ValueList
						data={value}
						max={2}
						direction="column"
						renderItem={item => (
							<ValueMosaic
								mosaicId={item.id}
								mosaicName={item.name}
								amount={item.amount}
								isTickerShown
								direction={direction}
							/>
						)}
					/>
				</div>
				<ValueAccount address={sender} size="sm" />
				{!!recipient && (
					<div className={styles.row}>
						<CustomImage className={styles.iconDirection} src="/images/icon-transaction-direction.svg" />
						<ValueAccount address={recipient} size="sm" />
					</div>
				)}
				{isTimestampShown && <ValueTimestamp value={timestamp} hasTime />}
			</div>
		</Link>
	);
};

export default ItemTransactionMobile;
