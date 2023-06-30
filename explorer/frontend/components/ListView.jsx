import styles from '@/styles/components/ValueMosaic.module.scss';
import Image from 'next/image';

const NATIVE_MOSAIC_ID = '6BED913FA20223F8';
const NATIVE_MOSAIC_TICKER = 'XEM';

const ValueMosaic = ({ mosaicName, mosaicId, amount = 0, className, onClick }) => {
	let displayedName;
	let imageSrc;

	const [integer, decimal] = amount.toString().split('.');

	if (mosaicId === NATIVE_MOSAIC_ID) {
		displayedName = NATIVE_MOSAIC_TICKER;
		imageSrc = '/images/icon-mosaic-native.svg';
	} else {
		displayedName = mosaicName;
		imageSrc = '/images/icon-mosaic-custom.svg';
	}

	const handleClick = () => onClick && onClick(mosaicId);

	return (
		<div className={`${styles.valueMosaic} ${className}`} onClick={handleClick}>
			<div className={styles.icon}>
				<Image src={imageSrc} fill alt="Mosaic" />
			</div>
			<div className={styles.amount}>
				<div>{integer}</div>
				{!!decimal && <div className={styles.decimal}>.{decimal}</div>}
			</div>
			<div>{displayedName}</div>
		</div>
	);
};

export default ValueMosaic;
