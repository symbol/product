import Field from './Field';
import styles from '@/app/styles/components/Progress.module.scss';
import { styleVariables } from '@/app/variants/styles';

const colorMap = {
	default: styleVariables.colorProgressDefault,
	danger: styleVariables.colorProgressDanger
};

// Keeps the header cell height when a title is omitted, so both values stay vertically aligned.
const TITLE_PLACEHOLDER = ' ';

const sizeMap = {
	small: styles.size__small,
	medium: styles.size__medium,
	large: styles.size__large
};

const Progress = ({ titleLeft, titleRight, valueLeft, valueRight, value, className, onClick, type, size }) => {
	const rawPercentage = ((value - valueLeft) * 100) / (valueRight - valueLeft);
	const progressPercentage = Number.isFinite(rawPercentage) ? Math.max(rawPercentage, 0) : 0;
	const progressStyle = {
		width: `${progressPercentage}%`,
		backgroundColor: colorMap[type] || colorMap.default
	};
	const progressClassName = `${styles.progress} ${sizeMap[size] || sizeMap.large}`;

	return (
		<div className={className} onClick={onClick}>
			<div className={styles.fields}>
				<Field title={titleLeft || TITLE_PLACEHOLDER}>{valueLeft}</Field>
				<Field title={titleRight || TITLE_PLACEHOLDER} textAlign="right">
					{valueRight}
				</Field>
			</div>
			<div className={progressClassName}>
				<div className={styles.progressInner} style={progressStyle} />
			</div>
		</div>
	);
};

export default Progress;
