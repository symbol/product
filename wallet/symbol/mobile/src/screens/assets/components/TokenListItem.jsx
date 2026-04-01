import { Amount, ListItemContainer, StyledText, TokenAvatar } from '@/app/components';
import { ExpirationProgress } from '@/app/screens/assets/components';
import { getTokenDisplayInfo } from '@/app/screens/assets/utils';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const PROGRESS_WIDTH = Sizes.Semantic.spacing.m * 15;

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * @typedef {Object} TokenListItemProps
 * @property {Token} token - Token data to display
 * @property {string} chainName - Chain name identifier
 * @property {NetworkIdentifier} networkIdentifier - Network identifier (mainnet/testnet)
 * @property {number} chainHeight - Current blockchain height
 * @property {number} blockGenerationTargetTime - Average block generation time in seconds
 * @property {function(Token): void} [onPress] - Optional press handler
 */

/**
 * TokenListItem component. Displays a token in a list with avatar, name, amount,
 * and optional expiration progress indicator.
 * @param {TokenListItemProps} props - Component props
 * @returns {React.ReactNode} TokenListItem component
 */
export const TokenListItem = ({ token, chainName, networkIdentifier, chainHeight, blockGenerationTargetTime, onPress }) => {
	const tokenDisplayData = getTokenDisplayInfo(token, chainName, networkIdentifier);

	// Expiration progress
	const isProgressShown = token.endHeight && !token.isUnlimitedDuration;

	// Handlers
	const handlePress = () => {
		onPress?.(token);
	};

	return (
		<ListItemContainer cardStyle={styles.root} onPress={handlePress}>
			<TokenAvatar imageId={tokenDisplayData.imageId} size="l" />
			<View>
				<StyledText>
					{tokenDisplayData.name}
				</StyledText>
				<Amount size="l" value={token.amount} />
				{isProgressShown && (
					<ExpirationProgress
						startHeight={token.startHeight}
						endHeight={token.endHeight}
						chainHeight={chainHeight}
						blockGenerationTargetTime={blockGenerationTargetTime}
						style={styles.expirationProgress}
					/>
				)}
			</View>
		</ListItemContainer>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	},
	expirationProgress: {
		width: PROGRESS_WIDTH
	}
});
