import CustomImage from './CustomImage';
import config from '@/config';
import styles from '@/styles/components/ValueMosaic.module.scss';

const ValueMosaic = ({ mosaicName, mosaicId, amount = 0, isNative, className, onClick }) => {
	if (isNaN(amount) || amount === null) return null;

	let displayedName;
	let imageSrc;

	const [integer, decimal] = amount.toString().split('.');

	if (mosaicId === config.NATIVE_MOSAIC_ID || isNative) {
		displayedName = '';
		imageSrc = '/images/icon-mosaic-native.svg';
	} else {
		displayedName = mosaicName;
		imageSrc = '/images/icon-mosaic-custom.svg';
	}

	const handleClick = () => onClick && onClick(mosaicId);

	return (
		<div className={`${styles.valueMosaic} ${className}`} onClick={handleClick}>
			<CustomImage src={imageSrc} className={styles.icon} alt="Mosaic" />
			<div className={styles.amount}>
				<div>{integer}</div>
				{!!decimal && <div className={styles.decimal}>.{decimal}</div>}
			</div>
			{!!displayedName && <div>{displayedName}</div>}
		</div>
	);
};

export default ValueMosaic;
