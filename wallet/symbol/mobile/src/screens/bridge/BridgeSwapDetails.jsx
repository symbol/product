import { ActivityLogView, Screen, Spacer, Stack, StatusRow, StyledText } from '@/app/components';
import { bridges } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import { SwapSideDetails } from '@/app/screens/bridge/components';
import { SwapSideType } from '@/app/screens/bridge/types/Bridge';
import { buildActivityLog, getSwapSourceData, getSwapStatus, getSwapTargetData } from '@/app/screens/bridge/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */

/**
 * BridgeSwapDetails screen component. Displays detailed information about a completed
 * or in-progress bridge swap transaction, including source and target chain details,
 * transaction hashes, account information, and a step-by-step activity log tracking
 * the swap progress from request to payout confirmation.
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} props.route.params.bridgeId - ID of the bridge.
 * @param {string} props.route.params.requestTransactionHash - Hash of the request transaction.
 * @param {BridgeRequest} [props.route.params.preloadedData] - Optional preloaded bridge request data.
 * @returns {import('react').ReactNode} BridgeSwapDetails component
 */
export const BridgeSwapDetails = ({ route }) => {
	const { bridgeId, preloadedData } = route.params;
	const bridge = bridges.find(b => b.id === bridgeId);

	const data = preloadedData;
	const { sourceChainName, targetChainName } = data;

	const status = getSwapStatus(data.requestStatus, data.payoutStatus);

	const sourceWalletController =
        bridge.nativeWalletController.chainName === sourceChainName
        	? bridge.nativeWalletController
        	: bridge.wrappedWalletController;

	const targetWalletController =
        bridge.nativeWalletController.chainName === targetChainName
        	? bridge.nativeWalletController
        	: bridge.wrappedWalletController;

	const sourceData = getSwapSourceData(data, sourceWalletController);
	const targetData = getSwapTargetData(data, targetWalletController);

	const activityLog = buildActivityLog({
		requestStatus: data.requestStatus,
		payoutStatus: data.payoutStatus,
		requestTimestamp: data.requestTransaction?.timestamp,
		payoutTimestamp: data.payoutTransaction?.timestamp,
		errorMessage: data.errorMessage
	});

	return (
		<Screen>
			<Spacer>
				<Stack gap="xl">
					<Stack>
						<StatusRow
							variant={status.variant}
							icon={status.iconName}
							statusText={status.text}
						/>
						<Stack gap="s">
							<StyledText type="title" size="s">
								{$t('s_bridge_swapDetails_tokenSend_title')}
							</StyledText>
							<SwapSideDetails
								type={SwapSideType.SOURCE}
								chainName={sourceData.chainName}
								networkIdentifier={sourceData.networkIdentifier}
								token={sourceData.token}
								account={sourceData.account}
								transactionHash={sourceData.transactionHash}
							/>
						</Stack>
						<Stack gap="s">
							<StyledText type="title" size="s">
								{$t('s_bridge_swapDetails_tokenReceive_title')}
							</StyledText>
							<SwapSideDetails
								type={SwapSideType.TARGET}
								chainName={targetData.chainName}
								networkIdentifier={targetData.networkIdentifier}
								token={targetData.token}
								account={targetData.account}
								transactionHash={targetData.transactionHash}
							/>
						</Stack>
					</Stack>
					<Stack gap="s">
						<StyledText type="title">
							{$t('s_bridge_swapDetails_statusTracking_title')}
						</StyledText>
						<ActivityLogView data={activityLog} />
					</Stack>
				</Stack>
			</Spacer>
		</Screen>
	);
};
