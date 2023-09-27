import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import styles from '@/styles/components/ItemAccountMobile.module.scss';

const ItemAccountMobile = ({ data }) => {
	const { address, importance, balance, label } = data;

	return (
		<div className={styles.itemAccountMobile}>
			<ValueAccount address={address} size="sm" />
			<div className={styles.row}>
				{importance} %
				<ValueMosaic isNative amount={balance} />
			</div>
			<div>{label}</div>
		</div>
	);
};

export default ItemAccountMobile;
