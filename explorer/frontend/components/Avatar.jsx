import CustomImage from './CustomImage';
import IconTransactionType from './IconTransactionType';
import config from '@/config';
import styles from '@/styles/components/Avatar.module.scss';
import hslToRgb from 'hsl-rgb';

const getColorFromHash = hash => {
	if (!hash) {
		return '#000';
	}

	const spread = 100;
	const saturation = 0.9;
	const lightness = 0.8;
	const numbers = [...Array(10).keys()];
	const alphabet = Array.from(Array(26))
		.map((_, i) => i + 65)
		.map(x => String.fromCharCode(x));
	const charset = [...numbers, ...alphabet];

	let totalValue = 0;

	for (const char of hash) totalValue += charset.indexOf(char.toUpperCase());

	const k = Math.trunc(totalValue / spread);
	const offsetValue = totalValue - spread * k;
	const hue = offsetValue / 100;

	const color = hslToRgb(hue * 360, saturation, lightness);

	return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

const AccountAvatar = ({ address }) => {
	const getImage = () => {
		const addressSrcMap = {
			A: '/images/avatars/avatar-1.png',
			B: '/images/avatars/avatar-2.png',
			C: '/images/avatars/avatar-3.png',
			D: '/images/avatars/avatar-4.png'
		};

		const addressSecondChar = address[1].toUpperCase();
		const src = addressSrcMap[addressSecondChar];

		return {
			src,
			style: {
				backgroundColor: getColorFromHash(address)
			}
		};
	};

	const image = address?.length > 2 ? getImage() : { src: '/images/icon-question.png' };

	return <CustomImage src={image.src} className={styles.image} style={image.style} />;
};

const MosaicAvatar = ({ mosaicId }) => {
	const mosaicIdSrcMap = {
		[config.NATIVE_MOSAIC_ID]: '/images/mosaics/currency.png'
	};
	const customMosaicSrc = '/images/mosaics/custom.png';
	const imageSrc = mosaicIdSrcMap[mosaicId] ? mosaicIdSrcMap[mosaicId] : customMosaicSrc;

	return <CustomImage src={imageSrc} className={styles.image} />;
};

const NamespaceAvatar = () => {
	return <CustomImage src={'/images/namespaces/namespace.svg'} className={styles.image} />;
};

const BlockAvatar = () => {
	return <CustomImage src={'/images/blocks/block.svg'} className={styles.image} />;
};

const TransactionAvatar = ({ type }) => {
	return (
		<div className={styles.imageDefault}>
			<IconTransactionType value={type} className={styles.imageTransactionType} />
		</div>
	);
};

const Avatar = ({ size, type, value, dot }) => {
	const sizeStyleMap = {
		sm: styles.containerSm,
		md: styles.containerMd,
		lg: styles.containerLg,
		xl: styles.containerXl
	};
	const dotStyleMap = {
		red: styles.dotRed,
		green: styles.dotGreen
	};

	const ChildComponent =
		type === 'account' ? (
			<AccountAvatar address={value} />
		) : type === 'mosaic' ? (
			<MosaicAvatar mosaicId={value} />
		) : type === 'transaction' ? (
			<TransactionAvatar type={value} />
		) : type === 'block' ? (
			<BlockAvatar />
		) : type === 'namespace' ? (
			<NamespaceAvatar namespaceId={value} />
		) : null;

	return (
		<div className={`${styles.container} ${sizeStyleMap[size]}`}>
			{ChildComponent}
			{!!dot && <div className={dotStyleMap[dot]} />}
		</div>
	);
};

export default Avatar;
