import Avatar from './Avatar';
import ValueLabel from './ValueLabel';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemMosaicMobile.module.scss';
import { createPageHref } from '@/utils';
import { useTranslation } from 'next-i18next';

const ItemMosaicMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const { name, id, registrationTimestamp, namespaceExpirationHeight, isUnlimitedDuration } = data;

	const isActive = isUnlimitedDuration || chainHeight < namespaceExpirationHeight;
	const status = isActive ? 'active' : 'inactive';
	const text = isActive ? t('label_active') : t('label_expired');

	return (
		<a className={styles.itemMosaicMobile} href={createPageHref('mosaics', id)}>
			<Avatar type="mosaic" size="md" value={id} />
			<div className={styles.info}>
				<div className={styles.name}>{name}</div>
				<div className="layout-flex-row">
					<ValueTimestamp className={styles.timestamp} value={registrationTimestamp} />
					<ValueLabel type={status} text={text} />
				</div>
			</div>
		</a>
	);
};

export default ItemMosaicMobile;
