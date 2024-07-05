import Avatar from './Avatar';
import ValueLabel from './ValueLabel';
import ValueMosaic from './ValueMosaic';
import styles from '@/styles/components/ItemAccountMobile.module.scss';
import { createPageHref } from '@/utils';

const ItemAccountMobile = ({ data }) => {
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
						<ValueLabel type="harvesting" className={harvestingLabelStyle} />
						<ValueLabel type="multisig" className={multisigLabelStyle} />
					</div>
				</div>
			</div>
		</a>
	);
};

export default ItemAccountMobile;
