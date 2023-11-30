import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueLabel.module.scss';

const iconsMap = {
	created: '/images/icon-label-true.svg',
	safe: '/images/icon-label-confirmed.svg',
	confirmed: '/images/icon-label-confirmed.svg',
	true: '/images/icon-label-true.svg',
	active: '/images/icon-label-true.svg',
	pending: '/images/icon-label-pending.svg',
	false: '/images/icon-label-false.svg',
	inactive: '/images/icon-label-false.svg',
	harvesting: '/images/icon-label-harvesting.svg',
	multisig: '/images/icon-label-multisig.svg'
};
const styleMap = {
	created: styles.success,
	safe: styles.success,
	confirmed: styles.success,
	true: styles.success,
	active: styles.success,
	pending: styles.warning,
	false: styles.danger,
	inactive: styles.danger,
	harvesting: styles.info,
	multisig: styles.info
};

const ValueLabel = ({ text, type, isIconHidden, title }) => {
	const iconSrc = iconsMap[type];
	const colorStyle = styleMap[type];
	const isTextShown = !!text;
	const rootStyles = isTextShown ? styles.valueLabel : `${styles.valueLabel} ${styles.valueLabel__noText}`;

	return (
		<div className={rootStyles} title={title}>
			{!isIconHidden && <CustomImage src={iconSrc} className={`${styles.icon} ${colorStyle}`} />}
			{isTextShown && <div className={colorStyle}>{text}</div>}
		</div>
	);
};

export default ValueLabel;
