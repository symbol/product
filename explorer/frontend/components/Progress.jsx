import { styleVariables } from '@/styles';
import Field from './Field';
import styles from '@/styles/components/Progress.module.scss';

const colorMap = {
	default: styleVariables.colorProgressDefault,
	danger: styleVariables.colorProgressDanger,
};

const sizeMap = {
	small: styles.size__small,
	medium: styles.size__medium,
	large: styles.size__large,
}

const Progress = ({ titleLeft, titleRight, valueLeft, valueRight, value, progress, className, onClick, type, size }) => {
	const progressPercentage = progress || (((value - valueLeft) * 100) / (valueRight - valueLeft));
	const progressStyle = {
		width: `${progressPercentage < 0 ? 0 : progressPercentage}%`,
		backgroundColor: colorMap[type] || colorMap.default
	};
	const sizeClass = sizeMap[size] || styles.large;
	const progressContainerClassNames = `${styles.progress} ${sizeClass}`;

	return (
		<div className={className} onClick={onClick}>
			<div className={styles.fields}>
				<Field title={titleLeft}>{valueLeft}</Field>
				<Field title={titleRight} textAlign="right">
					{valueRight}
				</Field>
			</div>
			<div className={progressContainerClassNames}>
				<div className={styles.progressInner} style={progressStyle} />
			</div>
		</div>
	);
};

export default Progress;
