import Avatar from './Avatar';
import CustomImage from './CustomImage';
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
		<div className={styles.itemTransactionMobile}>
			<Link className={styles.mainSection} href={createPageHref('transactions', hash)}>
				<Avatar type="transaction" size="md" value={type} />
				<div className={styles.info}>
					<div className={styles.name}>{typeText}</div>
					<div className="layout-flex-row">
						<ValueTransactionHash value={hash} />
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
				</div>
			</Link>
			<div>
				<ValueAccount address={sender} size="sm" />
				{!!recipient && (
					<div className={styles.row}>
						<CustomImage
							className={styles.iconDirection}
							src="/images/icon-transaction-direction.svg"
							alt="Transaction direction"
						/>
						<ValueAccount address={recipient} size="sm" />
					</div>
				)}
			</div>
			{isTimestampShown && <ValueTimestamp value={timestamp} hasTime />}
		</div>
	);
};

export default ItemTransactionMobile;
