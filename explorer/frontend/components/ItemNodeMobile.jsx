import Avatar from './Avatar';
import Field from './Field';
import ValueMosaic from './ValueMosaic';
import styles from '@/styles/components/ItemNodeMobile.module.scss';
import { createPageHref, formatNodeRoles } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemNodeMobile = ({ data, showAddress, showRoles }) => {
	const { t } = useTranslation();
	const { address, name, endpoint, balance, version, height, finalizedHeight, mainPublicKey, roles } = data;

	return (
		<div className={styles.itemNodeMobile}>
			<Link className={styles.mainSection} href={createPageHref('nodes', mainPublicKey)}>
				<Avatar type="node" size="md" />
				<div className={styles.info}>
					<div className={styles.name}>{name}</div>
					<div>{showRoles ? formatNodeRoles(roles, t) : endpoint}</div>
				</div>
			</Link>
			{showAddress && (
				<div className="layout-flex-row">
					<Field title={t('field_address')}>
						{address}
					</Field>
				</div>
			)}
			<div className="layout-flex-row">
				<Field title={t('field_balance')}>
					<ValueMosaic isNative amount={balance} />
				</Field>
				<Field title={t('field_height')}>
					{height}
				</Field>
			</div>
			<div className="layout-flex-row">
				<Field title={t('field_version')} textAlign="right">
					{version}
				</Field>
				<Field title={t('field_finalizedHeight')} textAlign="right">
					{finalizedHeight}
				</Field>
			</div>
		</div>
	);
};

export default ItemNodeMobile;
