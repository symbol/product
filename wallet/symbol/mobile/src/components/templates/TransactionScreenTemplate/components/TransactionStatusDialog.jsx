import { TransactionStatusInfoType, TransactionStatusStep } from '../constants';
import { buildActivityLog, getStatusInfo } from '../utils';
import { ActivityLogView, ButtonPlain, DialogBox, Stack, StatusCard, StyledText } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { createExplorerTransactionUrl } from '@/app/utils';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** @typedef {import('@/app/types/Action').ActionState} ActionState */

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/** @typedef {import('wallet-common-core/src/types/Chain').ChainName} ChainName */

/**
 * @typedef {Object} TransactionStatusDialogProps
 * @property {boolean} isVisible - Controls the visibility of the status dialog
 * @property {ActionState} createStatus - Current status of the transaction creation step
 * @property {ActionState} signStatus - Current status of the transaction signing step
 * @property {ActionState} announceStatus - Current status of the transaction announcement step
 * @property {number} transactionCount - Total number of transactions in the bundle
 * @property {string[]} signedTransactionHashes - Array of transaction hashes after signing
 * @property {string[]} confirmedTransactionHashes - Array of transaction hashes that have been confirmed
 * @property {string[]} failedTransactionHashes - Array of transaction hashes that failed confirmation
 * @property {string[]} partialTransactionHashes - Array of transaction hashes in partial/multisig pending state
 * @property {ChainName} chainName - The blockchain network name (e.g., 'symbol', 'nem')
 * @property {NetworkIdentifier} networkIdentifier - Network identifier ('mainnet' or 'testnet')
 * @property {function(): void} onClose - Callback invoked when the dialog is closed
 */

/** @constant {number} BASE_ANIMATION_DELAY - Base delay in milliseconds for fade-in animations */
const BASE_ANIMATION_DELAY = 750;

/**
 * A dialog component that displays the real-time status of a transaction workflow.
 * Shows an activity log with create, sign, announce, and confirm steps, along with a status card
 * indicating the overall transaction state. Provides links to view transactions in the block explorer
 * once they have been announced to the network.
 * 
 * @param {TransactionStatusDialogProps} props - Component props
 * 
 * @returns {React.ReactNode} Transaction status dialog component
 */
export const TransactionStatusDialog = props => {
	const {
		isVisible,
		createStatus,
		signStatus,
		announceStatus,
		transactionCount,
		signedTransactionHashes,
		confirmedTransactionHashes,
		failedTransactionHashes,
		partialTransactionHashes,
		chainName,
		networkIdentifier,
		onClose
	} = props;

	// Derived state
	const isAllTransactionsConfirmed = confirmedTransactionHashes?.length === transactionCount && transactionCount > 0;
	const hasFailedTransactions = failedTransactionHashes?.length > 0;
	const isPartialState = partialTransactionHashes?.length > 0;
	const isProcessing = createStatus?.status === 'loading' ||
		signStatus?.status === 'loading' ||
		announceStatus?.status === 'loading';

	// Build activity log data
	const activityLog = buildActivityLog({
		createStatus,
		signStatus,
		announceStatus,
		isAllTransactionsConfirmed,
		hasFailedTransactions
	});
	const activityLogTitleMap = {
		[TransactionStatusStep.CREATE]: 'Create Transaction',
		[TransactionStatusStep.SIGN]: 'Sign Transaction',
		[TransactionStatusStep.ANNOUNCE]: 'Send Transaction',
		[TransactionStatusStep.CONFIRM]: 'Confirmation'
	};
	const activityLogData = activityLog.map(item => ({
		title: activityLogTitleMap[item.type],
		icon: item.icon,
		status: item.status,
		caption: item.caption
	}));

	// Get status card info
	const statusInfo = getStatusInfo({
		createStatus,
		signStatus,
		announceStatus,
		isAllTransactionsConfirmed,
		hasFailedTransactions,
		isPartialState
	});
	const statusInfoTextMap = {
		[TransactionStatusInfoType.SENDING]: {
			title: 'Please Wait',
			description: 'Please do not close the app until the transaction has been sent.'
		},
		[TransactionStatusInfoType.CONFIRMING]: {
			title: 'Transaction Sent',
			description: 'Waiting for network confirmation. You can close this window or keep it open to watch the progress.'
		},
		[TransactionStatusInfoType.PARTIAL]: {
			title: 'Transaction Sent',
			description: 'Waiting for signatures from other parties. You can close this window or keep it open to watch the progress.'
		},
		[TransactionStatusInfoType.CONFIRMED]: {
			title: 'Success',
			description: 'Transaction confirmed!'
		},
		[TransactionStatusInfoType.CREATE_ERROR]: {
			title: 'Creation Failed',
			description: 'Transaction could not be created'
		},
		[TransactionStatusInfoType.SIGN_ERROR]: {
			title: 'Signing Failed',
			description: 'Transaction was not signed'
		},
		[TransactionStatusInfoType.ANNOUNCE_ERROR]: {
			title: 'Transaction Failed',
			description: 'Transaction was not broadcasted to the network'
		},
		[TransactionStatusInfoType.FAILED_TRANSACTIONS]: {
			title: 'Transaction Failed',
			description: 'Transaction was rejected by the network'
		}
	};
	const statusText = statusInfoTextMap[statusInfo.type];

	// Block explorer functionality
	const openBlockExplorer = hash => {
		PlatformUtils.openLink(createExplorerTransactionUrl(chainName, networkIdentifier, hash));
	};

	const showExplorerButtons = announceStatus?.status === 'completed' && signedTransactionHashes?.length > 0;

	return (
		<DialogBox
			type="alert"
			title="Send Transaction"
			isDisabled={isProcessing}
			isVisible={isVisible}
			onSuccess={onClose}
			style={styles.dialog}
		>
			<Stack>
				<StatusCard
					statusText={statusText.title}
					variant={statusInfo.variant}
					icon={statusInfo.icon}
				>
					<StyledText inverse>
						{statusText.description}
					</StyledText>
				</StatusCard>
				<ActivityLogView data={activityLogData} />
				{showExplorerButtons && signedTransactionHashes.map((hash, index) => (
					<Animated.View entering={FadeIn.delay(BASE_ANIMATION_DELAY)} key={hash}>
						{signedTransactionHashes.length > 1 && (
							<StyledText type="label" size="s" style={styles.transactionCounter}>
								{'Transaction ' + (index + 1)}
							</StyledText>
						)}
						<ButtonPlain
							icon="block-explorer"
							text={$t('button_openTransactionInExplorer')}
							onPress={() => openBlockExplorer(hash)}
						/>
					</Animated.View>
				))}
			</Stack>
		</DialogBox>
	);
};

const styles = StyleSheet.create({
	dialog: {
		flex: 1
	},
	transactionCounter: {
		opacity: 0.7
	}
});
