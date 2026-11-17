import { Colors, Sizes } from '@/app/styles';
import React, { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Steps component.
 *
 * Renders a horizontal progress indicator made of circles and connecting lines.
 * @param {object} props - Component props.
 * @param {number} props.stepsCount - Total number of steps.
 * @param {number} props.currentStep - 1-based index of the current step.
 * @returns {React.ReactNode} Steps component.
 */
export const Steps = ({ stepsCount, currentStep }) => {
	const currentIndex = currentStep - 1;
	const lastIndex = stepsCount - 1;

	return (
		<View style={styles.root}>
			{[...Array(stepsCount)].map((_, index) => {
				const isFirst = index === 0;
				const isLast = index === lastIndex;
				const isPast = index < currentIndex;
				const isCurrent = index === currentIndex;
				const isFuture = index > currentIndex;

				return (
					<Fragment key={`steps-fragment-${index}`}>
						{!isFirst && !isFuture && <View style={styles.lineActive} key={`steps-line-active-${index}`} />}
						{isPast && <View style={styles.circlePrevious} key={`steps-circle-previous-${index}`} />}
						{isCurrent && (
							<View style={styles.circleCurrent} key={`steps-circle-current-${index}`}>
								<View style={styles.circleCurrentInner} />
							</View>
						)}
						{isFuture && <View style={styles.circleNext} key={`steps-circle-next-${index}`} />}
						{!isLast && !isPast && <View style={styles.lineInactive} key={`steps-line-inactive-${index}`} />}
					</Fragment>
				);
			})}
		</View>
	);
};

const circleBorderWidth = Sizes.Semantic.borderWidth.m;
const circleBaseSize = Sizes.Semantic.spacing.xl;
const circleOuterSize = circleBaseSize - circleBorderWidth;
const circleInnerSize = circleOuterSize - (circleOuterSize / 3);
const circleInactiveSize = circleInnerSize;

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Sizes.Semantic.layoutPadding.m
	},
	lineActive: {
		flex: 1,
		height: Sizes.Semantic.borderWidth.m,
		backgroundColor: Colors.Semantic.role.secondary.default
	},
	lineInactive: {
		flex: 1,
		height: Sizes.Semantic.borderWidth.l,
		backgroundColor: Colors.Semantic.role.neutral.default
	},
	circlePrevious: {
		width: circleInactiveSize,
		height: circleInactiveSize,
		borderRadius: circleInactiveSize / 2,
		backgroundColor: Colors.Semantic.role.secondary.default
	},
	circleCurrent: {
		width: circleOuterSize,
		height: circleOuterSize,
		borderRadius: circleOuterSize / 2,
		borderWidth: circleBorderWidth,
		borderColor: Colors.Semantic.role.secondary.default,
		justifyContent: 'center',
		alignItems: 'center'
	},
	circleCurrentInner: {
		width: circleInnerSize,
		height: circleInnerSize,
		borderRadius: circleInnerSize / 2,
		backgroundColor: Colors.Semantic.content.primary.default
	},
	circleNext: {
		width: circleInactiveSize,
		height: circleInactiveSize,
		borderRadius: circleInactiveSize / 2,
		backgroundColor: Colors.Semantic.role.neutral.default
	}
});
