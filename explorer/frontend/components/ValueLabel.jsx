import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueLabel.module.scss';

const iconsMap = {
	confirmed: '/images/icon-label-confirmed.svg',
	true: '/images/icon-label-true.svg',
	false: '/images/icon-label-false.svg',
	harvesting: '/images/icon-label-harvesting.svg',
	multisig: '/images/icon-label-multisig.svg'
};
const styleMap = {
	confirmed: styles.success,
	true: styles.success,
	pending: styles.warning,
	false: styles.danger,
	harvesting: styles.info,
	multisig: styles.info
};

const ValueLabel = ({ text, type }) => {
	const iconSrc = iconsMap[type];
	const colorStyle = styleMap[type];

	return (
		<div className={styles.valueLabel}>
			<CustomImage src={iconSrc} className={`${styles.icon} ${colorStyle}`} />
			<div className={colorStyle}>{text}</div>
		</div>
	);
};

export default ValueLabel;
