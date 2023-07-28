import CustomImage from './CustomImage';
import config from '@/config';
import styles from '@/styles/components/ValueMosaic.module.scss';
import Avatar from './Avatar';

const ValueMosaic = ({ mosaicName, mosaicId, amount, isNative, className, direction, size, onClick }) => {

	let displayedName;
	let imageSrc;
	const directionStyle = styles[direction];
	const isAmountExist = !isNaN(amount) && amount !== null;
	const [integer, decimal] = isAmountExist ? amount.toString().split('.') : ['-'];

	if (mosaicId === config.NATIVE_MOSAIC_ID || isNative) {
		displayedName = '';
		imageSrc = '/images/icon-mosaic-native.svg';
	} else {
		displayedName = mosaicName;
		imageSrc = '/images/icon-mosaic-custom.svg';
	}

	const handleClick = () => onClick && onClick(mosaicId);

	return size === 'md'
	? (
		<div className={`${styles.valueMosaic} ${styles.containerMd} ${className}`} onClick={handleClick}>
			<Avatar type="mosaic" size="md" value={mosaicId} />
			<div className={styles.valueMosaicMdTextSection}>
				<div>{mosaicName}</div>
				{isAmountExist && <div>{amount}</div>}
			</div>
		</div>
	)
	: (
		<div className={`${styles.valueMosaic} ${directionStyle} ${className}`} onClick={handleClick}>
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
