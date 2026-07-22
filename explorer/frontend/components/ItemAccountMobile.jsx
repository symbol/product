import Avatar from './Avatar';
import ValueLabel from './ValueLabel';
import ValueMosaic from './ValueMosaic';
import styles from '@/app/styles/components/ItemAccountMobile.module.scss';
import { createPageHref } from '@/app/utils';
import { useTranslation } from 'next-i18next';

const ItemAccountMobile = ({ data }) => {
	const { t } = useTranslation();
	const { address, balance, isHarvestingActive, isMultisig } = data;
	const multisigLabelStyle = !isMultisig && styles.label__hidden;
	const harvestingLabelStyle = !isHarvestingActive && styles.label__hidden;

	return (
		<a className={styles.itemAccountMobile} href={createPageHref('accounts', address)}>
			<Avatar type="account" size="md" value={address} />
			<div className={styles.info}>
				<div className={styles.name}>{address}</div>
				<div className="layout-flex-row">
					<ValueMosaic isNative isTickerShown amount={balance} />
					<div className={styles.labels}>
						<ValueLabel type="harvesting" className={harvestingLabelStyle} title={t('label_harvesting_description')} />
						<ValueLabel type="multisig" className={multisigLabelStyle} />
					</div>
				</div>
			</div>
		</a>
	);
};

export default ItemAccountMobile;
