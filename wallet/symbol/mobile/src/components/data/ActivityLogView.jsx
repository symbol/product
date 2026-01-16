import { Icon, LoadingIndicator, StyledText } from '@/app/components';
import { ActivityStatus } from '@/app/constants';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';

const BASE_ANIMATION_DELAY = 750;

/**
 * Displays the step indicator icon/loader for an activity item.
 * 
 * @param {object} props - Component props
 * @param {string} props.icon - Icon name to display
 * @param {import('@/app/types/Action').ActionStatus} props.status - Current status of the activity
 * @param {import('@/app/types/Action').ActionStatus} props.nextStatus - Status of the next activity item
 * @param {boolean} props.isLast - Whether this is the last item
 * @param {number} props.index - Index of the activity item
 */
const ActivityStep = ({ icon, status, nextStatus, isLast, index }) => {
	const colorStylePending = {
		backgroundColor: Colors.Semantic.background.primary.lighter
	};
	const colorStyleComplete = {
		backgroundColor: Colors.Semantic.role.secondary.default
	};
	const colorStyleError = {
		backgroundColor: Colors.Semantic.role.danger.default
	};

	const iconContainerStyle = [
		styles.activityIconContainer,
		(status === ActivityStatus.PENDING || status === ActivityStatus.LOADING) && colorStylePending,
		status === ActivityStatus.ERROR && colorStyleError,
		status === ActivityStatus.COMPLETE && colorStyleComplete
	];

	const lineStyle = [
		styles.activityStepLine,
		(nextStatus === ActivityStatus.PENDING || nextStatus === ActivityStatus.LOADING) && colorStylePending,
		nextStatus === ActivityStatus.ERROR && colorStylePending,
		nextStatus === ActivityStatus.COMPLETE && colorStyleComplete
	];

	const isLoading = status === ActivityStatus.LOADING;

	return (
		<View style={styles.activityStep}>
			<Animated.View
				style={iconContainerStyle}
				entering={FadeInUp.delay(BASE_ANIMATION_DELAY + (index * 100))}
			>
				{!isLoading && <Icon name={icon} size="xs" variant="inverse" />}
				{isLoading && <LoadingIndicator size="sm" />}
			</Animated.View>
			{!isLast && (
				<Animated.View
					style={lineStyle}
					entering={FadeInUp.delay((BASE_ANIMATION_DELAY + 250) + (index * 250))}
					layout={Layout.springify()}
				/>
			)}
		</View>
	);
};

/**
 * Displays a single activity item in the transaction send log.
 * 
 * @param {object} props - Component props
 * @param {import('@/app/types/ActivityLog').ActivityLogItem} props.item - Activity item data
 * @param {import('@/app/types/Action').ActionStatus} props.nextItemStatus - Status of the next activity item
 * @param {number} props.index - Index of the activity item
 * @param {boolean} props.isLast - Whether this is the last item
 */
const ActivityItem = ({ item, nextItemStatus, index, isLast }) => {
	const textColorStyle = item.status === ActivityStatus.ERROR
		? { color: Colors.Semantic.role.danger.default }
		: { color: Colors.Semantic.content.primary.default };

	return (
		<View style={styles.activityLogItem}>
			<ActivityStep
				icon={item.icon}
				status={item.status}
				nextStatus={nextItemStatus}
				isLast={isLast}
				index={index}
			/>
			<View style={styles.activityTextContainer}>
				<Animated.View entering={FadeIn.delay(BASE_ANIMATION_DELAY)}>
					<StyledText type="body" style={textColorStyle}>
						{item.title}
					</StyledText>
				</Animated.View>
				{item.caption && (
					<StyledText type="body" style={[styles.activityCaption, textColorStyle]}>
						{item.caption}
					</StyledText>
				)}
			</View>
		</View>
	);
};

/**
 * ActivityLogView component for displaying a list of activity items.
 * Renders a vertical list of activity steps with icons, titles, and optional captions.
 *
 * @param {object} props - Component props
 * @param {import('@/app/types/ActivityLog').ActivityLogItem[]} props.data - Array of activity items to display
 * @param {object} [props.style] - Additional styles for the root container
 *
 * @returns {React.ReactNode} Rendered ActivityLogView component
 */
export const ActivityLogView = ({ data, style }) => {
	return (
		<View style={style}>
			{data.map((item, index) => (
				<ActivityItem
					key={index}
					item={item}
					index={index}
					nextItemStatus={index < data.length - 1 ? data[index + 1].status : null}
					isLast={index === data.length - 1}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	activityStep: {
		flexDirection: 'column',
		alignItems: 'center'
	},
	activityIconContainer: {
		width: Sizes.Semantic.spacing.xxl,
		height: Sizes.Semantic.spacing.xxl,
		borderRadius: Sizes.Semantic.spacing.xxl / 2,
		justifyContent: 'center',
		alignItems: 'center'
	},
	activityStepLine: {
		width: Sizes.Semantic.borderWidth.m,
		flex: 2
	},
	activityLogItem: {
		flexDirection: 'row',
		gap: Sizes.Semantic.spacing.m,
		minHeight: 56,
		backgroundColor: 'transparent'
	},
	activityTextContainer: {
		paddingVertical: Sizes.Semantic.spacing.s,
		flex: 1,
		flexDirection: 'column'
	},
	activityCaption: {
		...Typography.Semantic.body.s,
		opacity: 0.7
	}
});
