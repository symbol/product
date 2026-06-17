import { ActivityLogView, ButtonPlain, DialogBox, Stack, StatusCard, StyledText } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { createExplorerTransactionUrl } from '@/app/utils';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';


const BASE_ANIMATION_DELAY = 750;

/** @typedef {import('../types/TransactionProgress').TransactionProgressViewModel} TransactionProgressViewModel */

/**
 * A dialog component that displays the real-time status of a transaction workflow.
 * Shows an activity log with create, sign, announce, and confirm steps, along with a status card
 * indicating the overall transaction state. Provides links to view transactions in the block explorer
 * once they have been announced to the network.
 * @param {object} props - Component props.
 * @param {boolean} props.isVisible - Controls the visibility of the status dialog.
 * @param {TransactionProgressViewModel} props.transactionProgressViewModel - View model with activity log, status info and explorer links.
 * @param {function(): void} props.onClose - Callback invoked when the dialog is closed.
 * @returns {React.ReactNode} Transaction status dialog component.
 */
export const TransactionProgressDialog = props => {
	const { isVisible, transactionProgressViewModel, onClose } = props;
	const { isCloseButtonDisabled, activityLogData, statusInfo, explorerLinks } = transactionProgressViewModel;

	const openBlockExplorer = ({ chainName, networkIdentifier, hash }) => {
		PlatformUtils.openLink(createExplorerTransactionUrl(chainName, networkIdentifier, hash));
	};

	return (
		<DialogBox
			type="alert"
			title={$t('c_transactionStatus_dialog_title')}
			isDisabled={isCloseButtonDisabled}
			isVisible={isVisible}
			onSuccess={onClose}
			style={styles.dialog}
		>
			<Stack>
				<StatusCard
					statusText={statusInfo.title}
					variant={statusInfo.variant}
					icon={statusInfo.icon}
				>
					<StyledText inverse>
						{statusInfo.description}
					</StyledText>
				</StatusCard>
				<ActivityLogView data={activityLogData} />
				{explorerLinks?.map((link, index) => (
					<Animated.View entering={FadeIn.delay(BASE_ANIMATION_DELAY)} key={link.hash}>
						{explorerLinks.length > 1 && (
							<StyledText type="label" size="s" style={styles.transactionCounter}>
								{$t('c_transactionStatus_transaction_text', { index: index + 1 })}
							</StyledText>
						)}
						<ButtonPlain
							icon="block-explorer"
							text={$t('button_openTransactionInExplorer')}
							onPress={() => openBlockExplorer(link)}
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
