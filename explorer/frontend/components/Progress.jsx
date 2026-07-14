import Field from './Field';
import styles from '@/app/styles/components/Progress.module.scss';
import { styleVariables } from '@/app/variants/styles';

const colorMap = {
	default: styleVariables.colorProgressDefault,
	danger: styleVariables.colorProgressDanger
};

const Progress = ({ titleLeft, titleRight, valueLeft, valueRight, value, className, onClick, type }) => {
	const progressPercentage = ((value - valueLeft) * 100) / (valueRight - valueLeft);
	const progressStyle = {
		width: `${progressPercentage < 0 ? 0 : progressPercentage}%`,
		backgroundColor: colorMap[type] || colorMap.default
	};

	return (
		<div className={className} onClick={onClick}>
			<div className={styles.fields}>
				<Field title={titleLeft}>{valueLeft}</Field>
				<Field title={titleRight} textAlign="right">
					{valueRight}
				</Field>
			</div>
			<div className={styles.progress}>
				<div className={styles.progressInner} style={progressStyle} />
			</div>
		</div>
	);
};

export default Progress;
