import Avatar from './Avatar';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemBlockMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemBlockMobile = ({ data }) => {
	const { t } = useTranslation();
	const { height, harvester, timestamp, totalFee } = data;

	return (
		<div className={styles.itemBlockMobile}>
			<Link className={styles.mainSection} href={createPageHref('blocks', height)}>
				<Avatar type="block" size="md" value={height} />
				<div className={styles.info}>
					<div className={styles.name}>{height}</div>
					<div className="layout-flex-row">
						<ValueTimestamp className={styles.timestamp} value={timestamp} />
						<ValueMosaic isNative amount={totalFee} />
					</div>
				</div>
			</Link>
			<Field title={t('field_creator')}>
				<ValueAccount address={harvester} size="sm" />
			</Field>
		</div>
	);
};

export default ItemBlockMobile;
