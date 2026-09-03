import {
	Amount,
	AnimatedListItem,
	Icon,
	ListItemContainer,
	Stack,
	StatusRow,
	StyledText,
	TokenAvatar,
	TransactionAvatar
} from '@/app/components';
import { Colors, Sizes, Typography } from '@/app/styles';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapHistoryItem} SwapHistoryItem */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapHistoryViewModel} SwapHistoryViewModel */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

const ICON_NAME = 'swap';
const PENDING_COLOR = Colors.Semantic.role.warning.default;
const FAILED_COLOR = Colors.Semantic.role.danger.default;

/**
 * SwapChains component. Displays the source and target chains with their token avatars.
 * @param {object} props - Component props.
 * @param {{ chainName: ChainName, imageId: string|null }} props.source - Source chain display data.
 * @param {{ chainName: ChainName, imageId: string|null }} props.target - Target chain display data.
 * @returns {import('react').ReactNode} SwapChains component.
 */
const SwapChains = ({ source, target }) => (
	<View style={styles.swapChainsContainer}>
		<View style={styles.swapChain}>
			<TokenAvatar
				imageId={source.imageId}
				size="l"
				style={styles.tokenImage}
			/>
			<StyledText type="label" size="s">
				{source.chainName}
			</StyledText>
		</View>
		<Icon name="chevron-right" size="xs" />
		<View style={styles.swapChain}>
			<TokenAvatar
				imageId={target.imageId}
				size="l"
				style={styles.tokenImage}
			/>
			<StyledText type="label" size="s">
				{target.chainName}
			</StyledText>
		</View>
	</View>
);

/**
 * SwapListItem component. Displays one history row with its status and amount.
 * @param {object} props - Component props.
 * @param {SwapHistoryItem} props.item - The row to display.
 * @param {(item: SwapHistoryItem) => void} props.onPress - Press handler.
 * @returns {import('react').ReactNode} SwapListItem component.
 */
const SwapListItem = ({ item, onPress }) => {
	const captionTextStyleMap = {
		regular: styles.captionTextRegular,
		error: styles.captionTextError
	};

	const handlePress = () => {
		onPress(item);
	};

	return (
		<ListItemContainer
			borderColor={item.isPending ? PENDING_COLOR : null}
			contentContainerStyle={styles.root}
			onPress={handlePress}
		>
			<View style={styles.mainContent}>
				<View style={styles.iconSection}>
					<TransactionAvatar iconName={ICON_NAME} size="s" />
				</View>
				<View style={styles.middleSection}>
					<StyledText type="title" size="s">
						{item.actionText}
					</StyledText>
					<SwapChains source={item.source} target={item.target} />
					<StyledText type="body" size="s" style={styles.dateText}>
						{item.dateText}
					</StyledText>
				</View>
				<View style={styles.statusAndAmountSection}>
					{!!item.status && (
						<StatusRow
							variant={item.status.variant}
							icon={item.status.iconName}
							statusText={item.status.text}
						/>
					)}
					{!!item.amount && (
						<Amount
							value={item.amount.value}
							ticker={item.amount.ticker}
							size="m"
							style={styles.amount}
						/>
					)}
				</View>
			</View>
			{item.caption.isVisible && (
				<View style={styles.bottomCaption}>
					<StyledText
						type={item.caption.textType}
						style={captionTextStyleMap[item.caption.textStyle]}
					>
						{item.caption.text}
					</StyledText>
				</View>
			)}
		</ListItemContainer>
	);
};

/**
 * BridgeHistory component. Displays the recent swap rows and the page-size note.
 * @param {object} props - Component props.
 * @param {SwapHistoryViewModel} props.history - Rows and the page-size note.
 * @param {(item: SwapHistoryItem) => void} props.onItemPress - Row press handler.
 * @returns {import('react').ReactNode} BridgeHistory component.
 */
export const BridgeHistory = ({ history, onItemPress }) => (
	<Stack gap="l">
		<Stack gap="s">
			{history.items.map(item => (
				<AnimatedListItem key={item.key}>
					<SwapListItem item={item} onPress={onItemPress} />
				</AnimatedListItem>
			))}
		</Stack>
		<StyledText type="label" style={styles.pageSizeMessage}>
			{history.pageSizeText}
		</StyledText>
	</Stack>
);

const styles = StyleSheet.create({
	root: {
		flexDirection: 'column',
		width: '100%'
	},
	mainContent: {
		flexDirection: 'row',
		width: '100%'
	},
	iconSection: {
		flexDirection: 'column',
		justifyContent: 'center',
		paddingRight: Sizes.Semantic.spacing.m
	},
	middleSection: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'space-between'
	},
	swapChainsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.xs
	},
	swapChain: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.xs
	},
	statusAndAmountSection: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'flex-end',
		alignItems: 'flex-end',
		gap: Sizes.Semantic.spacing.xs
	},
	amount: {
		width: '200%',
		justifyContent: 'flex-end'
	},
	tokenImage: {
		marginRight: Sizes.Semantic.spacing.xs,
		height: Typography.Semantic.body.m.lineHeight,
		width: Typography.Semantic.body.m.lineHeight
	},
	dateText: {
		marginTop: Sizes.Semantic.spacing.xs,
		opacity: 0.7
	},
	bottomCaption: {
		margin: Sizes.Semantic.spacing.m
	},
	captionTextRegular: {
		textAlign: 'center',
		width: '100%'
	},
	captionTextError: {
		color: FAILED_COLOR
	},
	pageSizeMessage: {
		textAlign: 'center',
		width: '100%',
		opacity: 0.3
	}
});
