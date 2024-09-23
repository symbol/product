import Avatar from './Avatar';
import Field from './Field';
import styles from '@/styles/components/ItemNodeMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemNodeMobile = ({ data }) => {
	const { t } = useTranslation();
	const { name, endpoint, version, height, mainPublicKey } = data;

	return (
		<div className={styles.itemNodeMobile}>
			<Link className={styles.mainSection} href={createPageHref('nodes', mainPublicKey)}>
				<Avatar type="node" size="md" />
				<div className={styles.info}>
					<div className={styles.name}>{name}</div>
					<div>{endpoint}</div>
				</div>
			</Link>
			<div className="layout-flex-row">
				<Field title={t('field_height')}>
					{height}
				</Field>
				<Field title={t('field_version')} textAlign="right">
					{version}
				</Field>
			</div>
		</div>
	);
};

export default ItemNodeMobile;
