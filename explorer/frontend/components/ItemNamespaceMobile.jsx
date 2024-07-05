import Avatar from './Avatar';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueLabel from './ValueLabel';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemNamespaceMobile.module.scss';
import { createExpirationLabel, createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemNamespaceMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const { name, id, registrationTimestamp, creator, expirationHeight, isUnlimitedDuration } = data;
	const { status, text } = createExpirationLabel(expirationHeight, chainHeight, isUnlimitedDuration, t);

	return (
		<div className={styles.itemNamespaceMobile}>
			<Link className={styles.mainSection} href={createPageHref('namespaces', id)}>
				<Avatar type="namespace" size="md" value={id} />
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

export default ItemNamespaceMobile;
