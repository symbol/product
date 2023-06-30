import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueLabel.module.scss';

const iconsMap = {
	doublecheck: '/images/icon-doublecheck.svg'
};
const styleMap = {
	success: styles.success,
	warning: styles.warning,
	danger: styles.danger,
	info: styles.info
};

const ValueLabel = ({ text, type, iconName }) => {
	return (
		<div className={styles.valueLabel}>
			<CustomImage src={iconsMap[iconName]} className={`${styles.icon} ${styleMap[type]}`} />
			<div className={styleMap[type]}>{text}</div>
		</div>
	);
};

export default ValueLabel;
