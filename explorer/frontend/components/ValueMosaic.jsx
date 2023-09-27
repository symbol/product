import Avatar from './Avatar';
import CustomImage from './CustomImage';
import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, TRANSACTION_DIRECTION } from '@/constants';
import styles from '@/styles/components/ValueMosaic.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';

const ValueMosaic = ({ mosaicName, mosaicId, amount, isNative, className, direction, size, onClick, isNavigationDisabled }) => {
	let displayedName;
	let imageSrc;
	const directionStyleMap = {
		[TRANSACTION_DIRECTION.INCOMING]: styles.incoming,
		[ACCOUNT_STATE_CHANGE_ACTION.RECEIVE]: styles.incoming,
		[TRANSACTION_DIRECTION.OUTGOING]: styles.outgoing,
		[ACCOUNT_STATE_CHANGE_ACTION.SEND]: styles.outgoing
	};
	const directionStyle = directionStyleMap[direction];
	const isAmountExist = !isNaN(amount) && amount !== null;
	const [integer, decimal] = isAmountExist ? amount.toString().split('.') : ['-'];
	const finalMosaicId = isNative ? config.NATIVE_MOSAIC_ID : mosaicId;

	if (finalMosaicId === config.NATIVE_MOSAIC_ID) {
		displayedName = '';
		imageSrc = '/images/icon-mosaic-native.svg';
	} else {
		displayedName = mosaicName;
		imageSrc = '/images/icon-mosaic-custom.svg';
	}

	const handleClick = e => {
		e.stopPropagation();
		if (!onClick) return;
		if (isNavigationDisabled) e.preventDefault();
		onClick(finalMosaicId);
	};

	return size === 'md' ? (
		<Link
			className={`${styles.valueMosaic} ${styles.containerMd} ${className}`}
			href={createPageHref('mosaics', finalMosaicId)}
			onClick={handleClick}
		>
			<Avatar type="mosaic" size="md" value={finalMosaicId} />
			<div className={styles.valueMosaicMdTextSection}>
				<div>{mosaicName}</div>
				{isAmountExist && <div>{amount}</div>}
			</div>
		</Link>
	) : (
		<Link
			href={createPageHref('mosaics', finalMosaicId)}
			className={`${styles.valueMosaic} ${directionStyle} ${className}`}
			onClick={handleClick}
		>
			<CustomImage src={imageSrc} className={styles.icon} alt="Mosaic" />
			<div className={styles.amount}>
				<div>{integer}</div>
				{!!decimal && <div className={styles.decimal}>.{decimal}</div>}
			</div>
			{!!displayedName && <div>{displayedName}</div>}
		</Link>
	);
};

export default ValueMosaic;
