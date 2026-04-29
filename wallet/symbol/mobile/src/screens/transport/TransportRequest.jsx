import { RequestDetails, WalletActionGroup } from './components';
import { useSupportedChains } from './hooks';
import { 
	createRequestDetailsViewModel, 
	createTransportAlertData, 
	createWalletActions, 
	parseString, 
	validateTransportObject 
} from './utils';
import { Header } from '@/app/app/components';
import { Alert, Divider, Screen, Spacer, Stack, StyledText } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import React from 'react';

/**
 * TransportRequest screen component. Displays a transport URI received from a QR code scan.
 * Parses the URI, validates it, and shows relevant details and actions based on its content.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} props.route.params.transportUri - The transport URI to display.
 * @returns {React.ReactNode} TransportRequest screen component
 */
export const TransportRequest = ({ route }) => {
	const { transportUri } = route.params;

	const walletController = useWalletController();
	const { currentAccount, networkIdentifier, networkProperties } = walletController;

	// Parse string
	const { transportUri: transportUriObject, error } = parseString(transportUri);

	// Parse error alert
	const walletChains = useSupportedChains();
	const validationResult = validateTransportObject(transportUriObject, {
		networkProperties,
		networkIdentifier,
		supportedChains: walletChains.supported,
		activeChains: walletChains.active
	});
	const transportAlert = createTransportAlertData(error, validationResult, {
		transportUriObject,
		networkIdentifier
	});

	// Details view
	const requestDetailsViewModel = createRequestDetailsViewModel(transportUriObject);

	// The list of suggested and other actions to display, based on the transport URI content
	const walletActions = createWalletActions(transportUriObject, { chainName: walletController.chainName });

	// Visibility flags
	const isSuggestedActionsVisible = walletActions.suggested.length > 0;
	const isOtherActionsVisible = walletActions.other.length > 0;
	const isActionsSectionVisible = !error && !validationResult && (isSuggestedActionsVisible || isOtherActionsVisible);

	return (
		<Screen>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						{requestDetailsViewModel.isVisible && (
							<Stack>
								<Stack gap="none">
									<StyledText type="title">
										{requestDetailsViewModel.title}
									</StyledText>
									<StyledText>
										{requestDetailsViewModel.description}
									</StyledText>
								</Stack>
								<RequestDetails
									requestDetailsViewModel={requestDetailsViewModel}
									chainName={transportUriObject.chainName}
									networkIdentifier={transportUriObject.networkIdentifier}
									walletAccounts={walletController.accounts}
									addressBook={walletController.modules.addressBook}
								/>
							</Stack>
						)}
						{isActionsSectionVisible && (
							<Stack>
								<Divider />
								<StyledText type="title">
									{$t('s_transportRequest_actions_title')}
								</StyledText>
								{isSuggestedActionsVisible && (
									<WalletActionGroup
										title={$t('s_transportRequest_suggestedActions_group')}
										data={walletActions.suggested}
									/>
								)}
								{isOtherActionsVisible && (
									<WalletActionGroup
										title={$t('s_transportRequest_otherActions_group')}
										data={walletActions.other}
									/>
								)}
							</Stack>
						)}
						{transportAlert.isVisible && (
							<Alert
								variant={transportAlert.variant}
								body={transportAlert.text}
							/>
						)}
					</Stack>
				</Spacer>
			</Screen.Upper>
		</Screen>
	);
};
