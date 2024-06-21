import Avatar from './Avatar';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueLabel from './ValueLabel';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemMosaicMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemMosaicMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const { name, id, creator, registrationTimestamp, namespaceExpirationHeight, isUnlimitedDuration } = data;

	const isActive = isUnlimitedDuration || chainHeight < namespaceExpirationHeight;
	const status = isActive ? 'active' : 'inactive';
	const text = isActive ? t('label_active') : t('label_expired');

	return (
		<div className={styles.itemMosaicMobile}>
			<Link className={styles.mainSection} href={createPageHref('mosaics', id)}>
				<Avatar type="mosaic" size="md" value={id} />
				<div className={styles.info}>
					<div className={styles.name}>{name}</div>
					<div className="layout-flex-row">
						<ValueTimestamp className={styles.timestamp} value={registrationTimestamp} />
						<ValueLabel type={status} text={text} />
					</div>
				</div>
			</Link>
			<Field title={t('field_creator')}>
				<ValueAccount address={creator} size="sm" />
			</Field>
		</div>
	);
};

export default ItemMosaicMobile;
