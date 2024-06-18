import Avatar from './Avatar';
import ValueLabel from './ValueLabel';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemNamespaceMobile.module.scss';
import { createPageHref } from '@/utils';
import { useTranslation } from 'next-i18next';

const ItemNamespaceMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const { name, id, registrationTimestamp, expirationHeight } = data;

	const isActive = chainHeight < expirationHeight;
	const status = isActive ? 'active' : 'inactive';
	const text = isActive ? t('label_active') : t('label_expired');

	return (
		<a className={styles.itemNamespaceMobile} href={createPageHref('namespaces', id)}>
			<Avatar type="namespace" size="md" value={id} />
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

export default ItemNamespaceMobile;
