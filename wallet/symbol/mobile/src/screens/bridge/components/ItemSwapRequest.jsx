import { FormItem, ItemBase, StyledText } from '@/app/components';
import { config } from '@/app/config';
import { TransactionGroup, TransactionType } from '@/app/constants';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { $t } from '@/app/localization';
import { TokenIcon } from '@/app/screens/bridge/components/TokenIcon';
import { colors, fonts, spacings } from '@/app/styles';
import {
	formatDate,
	getAddressName,
	getUserCurrencyAmountText,
	isAggregateTransaction,
	isHarvestingServiceTransaction,
	isIncomingTransaction,
	isOutgoingTransaction,
	isTransactionAwaitingSignatureByAccount,
	trunc
} from '@/app/utils';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';


/**
 * Component that renders a single transaction item in a list.
 * @param {object} props - The component props.
 * @param {import('wallet-common-core/src/types/Bridge').BridgeRequest} props.request - The transaction object to display.
 * @param {function} [props.onPress] - Optional callback function to handle press events on the item.
 */
export const ItemSwapRequest = props => {
	const { request, onPress } = props;
	const { sourceChainName, targetChainName, sourceTokenInfo, targetTokenInfo, requestTransaction, payoutTransaction, payoutStatus, requestStatus } = request;
	const dateText = formatDate(requestTransaction.timestamp, $t, true);
	const action = 'Swap';
	const amountText = payoutTransaction
		? `${payoutTransaction.token.amount} ${payoutTransaction.token.name}`
		: '';

	// Status
	const statusTextStyle = [styles.statusText];
	let transactionIconSrc = require('@/app/assets/images/icon-tx-swap.png');
	let statusIconSrc;
	let statusText;
	let borderColor;
	switch (payoutStatus) {
		case 0:
			statusTextStyle.push(styles.statusTextUnprocessed);
			statusIconSrc = require('@/app/assets/images/icon-status-unconfirmed.png');
			statusText = 'Unprocessed';
			break;
		case 1:
			statusTextStyle.push(styles.statusTextSent);
			statusIconSrc = require('@/app/assets/images/icon-status-unconfirmed-sent.png');
			statusText = 'Sent';
			break;
		case 2:
			statusTextStyle.push(styles.statusTextCompleted);
			statusIconSrc = require('@/app/assets/images/icon-status-confirmed.png');
			statusText = 'Completed';
			break;
		case 3:
			statusTextStyle.push(styles.statusTextFailed);
			statusIconSrc = require('@/app/assets/images/icon-status-failed.png');
			statusText = 'Failed';
			break;
	}

	let errorText;
	let captionText;
	switch (requestStatus) {
		case 'confirmed':
			statusTextStyle.push(styles.statusTextSent);
			captionText = 'Transaction was successfully sent to the Bridge. The status will be displayed in a few minutes, once Bridge starts to work with your request';
			borderColor = colors.warning;
			break;
		case 'error':
			errorText = request.errorMessage;
			borderColor = colors.danger;
			transactionIconSrc = require('@/app/assets/images/icon-status-failed.png');
			break;
	}

	return (
		<ItemBase contentContainerStyle={styles.root} onPress={onPress} borderColor={borderColor}>
			<View style={styles.swapInfo}>
				<View style={styles.sectionTransactionIcon}>
					<Image source={transactionIconSrc} style={styles.transactionIcon} />
				</View>
				<View style={styles.sectionStart}>
					<Text style={styles.textAction}>{action}</Text>
					<View style={styles.icons}>
						<TokenIcon
							chainName={sourceChainName}
							tokenName={sourceTokenInfo.name}
							style={styles.iconToken}
						/>
						<Image
							source={require('@/app/assets/images/icon-arrow-right.png')}
							style={styles.iconArrow}
						/>
						<TokenIcon
							chainName={targetChainName}
							tokenName={targetTokenInfo.name}
							style={styles.iconToken}
						/>
					</View>
					<Text style={styles.textDate}>{dateText}</Text>
				</View>
				<View style={styles.sectionEnd}>
					<View style={styles.statusBadge}>
						<Image source={statusIconSrc} style={styles.statusIcon} />
						<Text style={statusTextStyle}>{statusText}</Text>
					</View>
					<Text style={styles.textAmount}>{amountText}</Text>
				</View>
			</View>
			{!!errorText && (
				<View style={styles.bottomCaption}>
					<StyledText type="label" style={styles.textError}>
						{errorText}
					</StyledText>
				</View>
			)}
			{!!captionText && (
				<View style={styles.bottomCaption}>
					<StyledText type="body" style={styles.textCaption}>
						{captionText}
					</StyledText>
				</View>
			)}
		</ItemBase>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'column',
		width: '100%',
	},
	swapInfo: {
		flexDirection: 'row',
		width: '100%',
	},
	bottomCaption: {
		margin: spacings.margin,
	},
	textCaption: {
		paddingHorizontal: spacings.padding,
		textAlign: 'center',
		width: '100%',
	},
	textError: {
		color: colors.danger,
	},
	textAction: {
		...fonts.subtitle,
		color: colors.textBody
	},
	textDate: {
		...fonts.body,
		color: colors.textBody,
		fontSize: 10,
		opacity: 0.7,
		textAlignVertical: 'center'
	},
	textAmount: {
		...fonts.body,
		color: colors.textBody
	},
	textUserCurrencyAmount: {
		...fonts.bodyBold,
		opacity: 0.7
	},
	icons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacings.margin / 2,
	},
	iconToken: {
		height: 16,
		width: 16
	},
	iconArrow: {
		height: 8,
		width: 8
	},
	sectionTransactionIcon: {
		flexDirection: 'column',
		justifyContent: 'center',
		paddingRight: spacings.padding
	},
	transactionIcon: {
		height: 24,
		width: 24
	},
	sectionStart: {
		flexDirection: 'column',
		justifyContent: 'space-between',
		gap: spacings.margin / 4,
	},
	sectionEnd: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'flex-end',
		alignItems: 'flex-end'
	},
	amount: {
		flexDirection: 'column',
		alignItems: 'flex-end'
	},
	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	statusText: {
		...fonts.body,
		color: colors.textBody
	},
	statusTextUnprocessed: {
		color: colors.warning
	},
	statusTextSent: {
		color: colors.warning
	},
	statusTextCompleted: {
		color: colors.success
	},
	statusTextFailed: {
		color: colors.danger
	},
	statusIcon: {
		width: 18,
		height: 18,
		marginRight: spacings.margin / 2
	},
});
