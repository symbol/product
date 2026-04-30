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
import { $t } from '@/app/localization';
import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { getSwapStatus, getSwapStatusCaption } from '@/app/screens/bridge/utils';
import { Colors, Sizes, Typography } from '@/app/styles';
import { formatDate, getTokenKnownInfo } from '@/app/utils';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

const ICON_NAME = 'swap';
const PENDING_COLOR = Colors.Semantic.role.warning.default;
const FAILED_COLOR = Colors.Semantic.role.danger.default;

/**
 * Gets border color for history item based on request status.
 * @param {BridgeRequest} data - The bridge request data.
 * @returns {string|null} Border color or null.
 */
const getBorderColor = data => {
	const { requestStatus } = data;

	if (requestStatus === BridgeRequestStatus.CONFIRMED)
		return PENDING_COLOR;

	return null;
};

/**
 * Gets display amount information for a bridge request.
 * @param {BridgeRequest} data - The bridge request data.
 * @param {NetworkIdentifier} networkIdentifier - The network identifier.
 * @returns {{isVisible: boolean, value?: string, ticker?: string, chainName?: string}} Amount info.
 */
const getAmount = (data, networkIdentifier) => {
	const { payoutTransaction, targetChainName } = data;

	if (!payoutTransaction)
		return { isVisible: false };

	const resolvedTokenInfo = getTokenKnownInfo(
		targetChainName,
		networkIdentifier,
		payoutTransaction.token.id
	);

	// Name
	const name = resolvedTokenInfo.name ?? payoutTransaction.token.name;
	const { ticker } = resolvedTokenInfo;

	const tokenTickerOrName = ticker ?? name;

	return {
		isVisible: true,
		value: payoutTransaction.token.amount,
		ticker: tokenTickerOrName,
		chainName: targetChainName
	};
};


/**
 * SwapChains component. Displays source and target chain with token avatars.
 * @param {object} props - Component props.
 * @param {ChainName} props.sourceChainName - Source chain name.
 * @param {ChainName} props.targetChainName - Target chain name.
 * @param {TokenInfo} props.sourceTokenInfo - Source token info.
 * @param {TokenInfo} props.targetTokenInfo - Target token info.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier.
 * @returns {import('react').ReactNode} SwapChains component.
 */
const SwapChains = ({ sourceChainName, targetChainName, sourceTokenInfo, targetTokenInfo, networkIdentifier }) => {
	const { imageId: sourceImageId } = getTokenKnownInfo(
		sourceChainName,
		networkIdentifier,
		sourceTokenInfo.id
	);

	const { imageId: targetImageId } = getTokenKnownInfo(
		targetChainName,
		networkIdentifier,
		targetTokenInfo.id
	);
	return (
		<View style={styles.swapChainsContainer}>
			<View style={styles.swapChain}>
				<TokenAvatar
					imageId={sourceImageId}
					size="l"
					style={styles.tokenImage}
				/>
				<StyledText type="label" size="s">
					{sourceChainName}
				</StyledText>
			</View>
			<Icon name="chevron-right" size="xs" />
			<View style={styles.swapChain}>
				<TokenAvatar
					imageId={targetImageId}
					size="l"
					style={styles.tokenImage}
				/>
				<StyledText type="label" size="s">
					{targetChainName}
				</StyledText>
			</View>
		</View>
	);
};

/**
 * SwapListItem component. Displays a single bridge history item with status and amount.
 * @param {object} props - Component props.
 * @param {BridgeRequest} props.data - Bridge request data.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier.
 * @param {(data: BridgeRequest) => void} props.onPress - Press handler.
 * @returns {import('react').ReactNode} SwapListItem component.
 */
const SwapListItem = ({ data, networkIdentifier, onPress }) => {
	const action = $t('transactionDescriptor_swap');
	const dateText = formatDate(data.requestTransaction.timestamp, $t, true);

	const borderColor = getBorderColor(data);
	const amount = getAmount(data, networkIdentifier);

	const status = getSwapStatus(data.requestStatus, data.payoutStatus);
	const isStatusVisible = data.payoutStatus !== undefined;

	const caption = getSwapStatusCaption(data);
	const captionTextStyleMap = {
		regular: styles.captionTextRegular,
		error: styles.captionTextError
	};

	const handlePress = () => {
		onPress(data);
	};

	return (
		<ListItemContainer
			borderColor={borderColor}
			contentContainerStyle={styles.root}
			onPress={handlePress}
		>
			<View style={styles.mainContent}>
				<View style={styles.iconSection}>
					<TransactionAvatar iconName={ICON_NAME} size="s" />
				</View>
				<View style={styles.middleSection}>
					<StyledText type="title" size="s">
						{action}
					</StyledText>
					<SwapChains
						sourceChainName={data.sourceChainName}
						targetChainName={data.targetChainName}
						sourceTokenInfo={data.sourceTokenInfo}
						targetTokenInfo={data.targetTokenInfo}
						networkIdentifier={networkIdentifier}
					/>
					<StyledText type="body" size="s" style={styles.dateText}>
						{dateText}
					</StyledText>
				</View>
				<View style={styles.statusAndAmountSection}>
					{isStatusVisible && (
						<StatusRow
							variant={status.variant}
							icon={status.iconName}
							statusText={status.text}
						/>
					)}
					{amount.isVisible && (
						<Amount value={amount.value} ticker={amount.ticker} size="m" />
					)}
				</View>
			</View>
			{caption.isVisible && (
				<View style={styles.bottomCaption}>
					<StyledText
						type={caption.textType}
						style={captionTextStyleMap[caption.textStyle]}
					>
						{caption.text}
					</StyledText>
				</View>
			)}
		</ListItemContainer>
	);
};

/**
 * BridgeHistory component. Displays a list of recent bridge transaction history items.
 * @param {object} props - Component props.
 * @param {BridgeRequest[]} props.history - Array of bridge request history items.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier for resolving token info.
 * @param {(data: BridgeRequest) => void} props.onItemPress - Handler for item press.
 * @returns {import('react').ReactNode} BridgeHistory component.
 */
export const BridgeHistory = ({ history, networkIdentifier, onItemPress }) => {
	const isPageSizeMessageVisible = history.length === BRIDGE_HISTORY_PAGE_SIZE;
	const pageSizeMessage = $t('s_bridge_history_page_size_message', { size: BRIDGE_HISTORY_PAGE_SIZE });

	return (
		<Stack gap="l">
			<Stack gap="s">
				{history.map(item => (
					<AnimatedListItem key={item.requestTransaction.hash}>
						<SwapListItem
							data={item}
							networkIdentifier={networkIdentifier}
							onPress={onItemPress}
						/>
					</AnimatedListItem>
				))}
			</Stack>
			<StyledText type="label" style={styles.pageSizeMessage}>
				{isPageSizeMessageVisible ? pageSizeMessage : ''}
			</StyledText>
		</Stack>
	);
};

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
