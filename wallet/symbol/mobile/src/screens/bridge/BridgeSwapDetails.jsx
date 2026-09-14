import { ActivityLogView, Screen, Spacer, Stack, StatusRow, StyledText } from '@/app/components';
import { bridges } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import { SwapSideDetails } from '@/app/screens/bridge/components';
import { SwapSideType } from '@/app/screens/bridge/types/Bridge';
import { createSwapDetailsViewModel } from '@/app/screens/bridge/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */

/**
 * BridgeSwapDetails screen component. Displays detailed information about a completed
 * or in-progress bridge swap transaction, including source and target chain details,
 * transaction hashes, account information, and a step-by-step activity log tracking
 * the swap progress from request to payout confirmation.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {string} props.route.params.bridgeId - ID of the bridge.
 * @param {string} props.route.params.requestTransactionHash - Hash of the request transaction.
 * @param {BridgeRequest} [props.route.params.preloadedData] - Optional preloaded bridge request data.
 * @returns {import('react').ReactNode} BridgeSwapDetails component.
 */
export const BridgeSwapDetails = ({ route }) => {
	const { bridgeId, preloadedData } = route.params;
	const bridge = bridges.find(b => b.id === bridgeId);

	const details = createSwapDetailsViewModel({
		request: preloadedData,
		sourceWalletController: bridge.sourceWalletController,
		targetWalletController: bridge.targetWalletController
	});

	return (
		<Screen>
			<Spacer>
				<Stack gap="xl">
					<Stack>
						<StatusRow
							variant={details.status.variant}
							icon={details.status.iconName}
							statusText={details.status.text}
						/>
						<Stack gap="s">
							<StyledText type="title" size="s">
								{$t('s_bridge_swapDetails_tokenSend_title')}
							</StyledText>
							<SwapSideDetails
								type={SwapSideType.SOURCE}
								chainName={details.source.chainName}
								networkIdentifier={details.source.networkIdentifier}
								token={details.source.token}
								account={details.source.account}
								transactionHash={details.source.transactionHash}
							/>
						</Stack>
						<Stack gap="s">
							<StyledText type="title" size="s">
								{$t('s_bridge_swapDetails_tokenReceive_title')}
							</StyledText>
							<SwapSideDetails
								type={SwapSideType.TARGET}
								chainName={details.target.chainName}
								networkIdentifier={details.target.networkIdentifier}
								token={details.target.token}
								account={details.target.account}
								transactionHash={details.target.transactionHash}
							/>
						</Stack>
					</Stack>
					<Stack gap="s">
						<StyledText type="title">
							{$t('s_bridge_swapDetails_statusTracking_title')}
						</StyledText>
						<ActivityLogView data={details.activityLog} />
					</Stack>
				</Stack>
			</Spacer>
		</Screen>
	);
};
