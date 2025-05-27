import { createAssetURL } from '@/utils';
import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueLabel.module.scss';

const iconsMap = {
	created: createAssetURL('/images/icon-label-true.svg'),
	safe: createAssetURL('/images/icon-label-confirmed.svg'),
	confirmed: createAssetURL('/images/icon-label-confirmed.svg'),
	true: createAssetURL('/images/icon-label-true.svg'),
	active: createAssetURL('/images/icon-label-true.svg'),
	pending: createAssetURL('/images/icon-label-pending.svg'),
	false: createAssetURL('/images/icon-label-false.svg'),
	inactive: createAssetURL('/images/icon-label-false.svg'),
	harvesting: createAssetURL('/images/icon-label-harvesting.svg'),
	multisig: createAssetURL('/images/icon-label-multisig.svg')
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

const ValueLabel = ({ className, text, type, isIconHidden, title }) => {
	const iconSrc = iconsMap[type];
	const colorStyle = styleMap[type];
	const isTextShown = !!text;
	const rootStyles = isTextShown ? styles.valueLabel : `${styles.valueLabel} ${styles.valueLabel__noText}`;

	return (
		<div className={`${rootStyles} ${className}`} title={title}>
			{!isIconHidden && <CustomImage src={iconSrc} className={`${styles.icon} ${colorStyle}`} alt={type} />}
			{isTextShown && <div className={colorStyle}>{text}</div>}
		</div>
	);
};

export default ValueLabel;
