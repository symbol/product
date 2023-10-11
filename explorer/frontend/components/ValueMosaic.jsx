import Avatar from './Avatar';
import CustomImage from './CustomImage';
import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, TRANSACTION_DIRECTION } from '@/constants';
import styles from '@/styles/components/ValueMosaic.module.scss';
import { createPageHref, numberToString } from '@/utils';
import Link from 'next/link';

const ValueMosaic = ({
	mosaicName,
	mosaicId,
	amount,
	isNative,
	className,
	direction,
	size,
	onClick,
	isNavigationDisabled,
	isTickerShown,
	chainHeight,
	expirationHeight
}) => {
	let displayedName;
	let imageSrc;
	let title;
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

	const dot = !chainHeight ? null : chainHeight < expirationHeight ? 'green' : 'red';

	if (finalMosaicId === config.NATIVE_MOSAIC_ID) {
		displayedName = isTickerShown ? config.NATIVE_MOSAIC_TICKER : '';
		imageSrc = '/images/icon-mosaic-native.svg';
		title = amount ? `${amount} ${config.NATIVE_MOSAIC_TICKER}` : '';
	} else {
		displayedName = mosaicName;
		imageSrc = '/images/icon-mosaic-custom.svg';
		title = amount ? `${amount} ${mosaicName}` : '';
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
			title={title}
			onClick={handleClick}
		>
			<Avatar type="mosaic" size="md" value={finalMosaicId} dot={dot} />
			<div className={styles.valueMosaicMdTextSection}>
				<div>{mosaicName}</div>
				{isAmountExist && <div>{numberToString(amount)}</div>}
			</div>
		</Link>
	) : (
		<Link
			href={createPageHref('mosaics', finalMosaicId)}
			className={`${styles.valueMosaic} ${directionStyle} ${className}`}
			title={title}
			onClick={handleClick}
		>
			<CustomImage src={imageSrc} className={styles.icon} alt="Mosaic" />
			<div className={styles.amount}>
				<div>{numberToString(integer)}</div>
				{!!decimal && <div className={styles.decimal}>.{decimal}</div>}
			</div>
			{!!displayedName && <div>{displayedName}</div>}
		</Link>
	);
};

export default ValueMosaic;
