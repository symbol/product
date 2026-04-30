import { TransactionStatusInfoType, TransactionStatusStep } from '../constants';
import { buildActivityLog, getStatusInfo } from '../utils';
import { ActivityLogView, ButtonPlain, DialogBox, Stack, StatusCard, StyledText } from '@/app/components';
import { ActivityStatus } from '@/app/constants';
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
 * Props for the TransactionStatusDialog component.
 * @typedef {object} TransactionStatusDialogProps
 * @property {boolean} isVisible - Controls the visibility of the status dialog.
 * @property {ActionState} createStatus - Current status of the transaction creation step.
 * @property {ActionState} signStatus - Current status of the transaction signing step.
 * @property {ActionState} announceStatus - Current status of the transaction announcement step.
 * @property {number} transactionCount - Total number of transactions in the bundle.
 * @property {string[]} signedTransactionHashes - Array of transaction hashes after signing.
 * @property {string[]} confirmedTransactionHashes - Array of transaction hashes that have been confirmed.
 * @property {string[]} failedTransactionHashes - Array of transaction hashes that failed confirmation.
 * @property {string[]} partialTransactionHashes - Array of transaction hashes in partial/multisig pending state.
 * @property {ChainName} chainName - The blockchain network name (e.g., 'symbol', 'nem').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier ('mainnet' or 'testnet').
 * @property {function(): void} onClose - Callback invoked when the dialog is closed.
 */

/** @constant {number} BASE_ANIMATION_DELAY - Base delay in milliseconds for fade-in animations */
const BASE_ANIMATION_DELAY = 750;

/**
 * A dialog component that displays the real-time status of a transaction workflow.
 * Shows an activity log with create, sign, announce, and confirm steps, along with a status card
 * indicating the overall transaction state. Provides links to view transactions in the block explorer
 * once they have been announced to the network.
 * @param {TransactionStatusDialogProps} props - Component props.
 * @returns {React.ReactNode} Transaction status dialog component.
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
		[TransactionStatusStep.CREATE]: $t('c_transactionStatus_step_create'),
		[TransactionStatusStep.SIGN]: $t('c_transactionStatus_step_sign'),
		[TransactionStatusStep.ANNOUNCE]: $t('c_transactionStatus_step_announce'),
		[TransactionStatusStep.CONFIRM]: $t('c_transactionStatus_step_confirm')
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
			title: $t('c_transactionStatus_status_sending_title'),
			description: $t('c_transactionStatus_status_sending_description')
		},
		[TransactionStatusInfoType.CONFIRMING]: {
			title: $t('c_transactionStatus_status_confirming_title'),
			description: $t('c_transactionStatus_status_confirming_description')
		},
		[TransactionStatusInfoType.PARTIAL]: {
			title: $t('c_transactionStatus_status_partial_title'),
			description: $t('c_transactionStatus_status_partial_description')
		},
		[TransactionStatusInfoType.CONFIRMED]: {
			title: $t('c_transactionStatus_status_confirmed_title'),
			description: $t('c_transactionStatus_status_confirmed_description')
		},
		[TransactionStatusInfoType.CREATE_ERROR]: {
			title: $t('c_transactionStatus_status_createError_title'),
			description: $t('c_transactionStatus_status_createError_description')
		},
		[TransactionStatusInfoType.SIGN_ERROR]: {
			title: $t('c_transactionStatus_status_signError_title'),
			description: $t('c_transactionStatus_status_signError_description')
		},
		[TransactionStatusInfoType.ANNOUNCE_ERROR]: {
			title: $t('c_transactionStatus_status_announceError_title'),
			description: $t('c_transactionStatus_status_announceError_description')
		},
		[TransactionStatusInfoType.FAILED_TRANSACTIONS]: {
			title: $t('c_transactionStatus_status_failedTransaction_title'),
			description: $t('c_transactionStatus_status_failedTransaction_description')
		}
	};
	const statusText = statusInfoTextMap[statusInfo.type];

	// Block explorer functionality
	const openBlockExplorer = hash => {
		PlatformUtils.openLink(createExplorerTransactionUrl(chainName, networkIdentifier, hash));
	};

	const showExplorerButtons = announceStatus?.status === ActivityStatus.COMPLETE && signedTransactionHashes?.length > 0;

	return (
		<DialogBox
			type="alert"
			title={$t('c_transactionStatus_dialog_title')}
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
								{$t('c_transactionStatus_transaction_text', { index: index + 1 })}
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
