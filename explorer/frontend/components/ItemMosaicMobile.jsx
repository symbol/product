import ValueMosaic from './ValueMosaic';
import styles from '@/styles/components/ItemMosaicMobile.module.scss';

const ItemMosaicMobile = ({ data }) => {
	const { name, id, supply } = data;

	return (
		<div className={styles.itemMosaicMobile}>
			<ValueMosaic mosaicName={name} mosaicId={id} amount={supply} size="md" />
		</div>
	);
};

export default ItemMosaicMobile;
