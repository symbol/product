import StatusIcon from './StatusIcon';
import styles from '@/app/styles/components/ValueLabel.module.scss';

const styleMap = {
	created: styles.success,
	safe: styles.success,
	confirmed: styles.success,
	finalized: styles.success,
	true: styles.success,
	active: styles.success,
	pending: styles.warning,
	false: styles.danger,
	inactive: styles.danger,
	harvesting: styles.info,
	multisig: styles.info
};

const ValueLabel = ({ className, text, type, isIconHidden, title }) => {
	const colorStyle = styleMap[type];
	const isTextShown = !!text;
	const rootStyles = isTextShown ? styles.valueLabel : `${styles.valueLabel} ${styles.valueLabel__noText}`;

	return (
		<div className={`${rootStyles} ${className}`} title={title}>
			{!isIconHidden && <StatusIcon type={type} className={colorStyle} />}
			{isTextShown && <div className={colorStyle}>{text}</div>}
		</div>
	);
};

export default ValueLabel;
