import { createBlacklistAlertData } from './utils';
import {
	AccountAvatar,
	Alert,
	Button,
	ButtonPlain,
	Card,
	CopyButtonContainer,
	Divider,
	Field,
	FlexContainer,
	Screen,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { useAsyncManager, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { createExplorerAccountUrl } from '@/app/utils';
import React from 'react';

/**
 * ContactDetails screen component. Displays details of a contact including
 * avatar, name, address with copy functionality, and notes.
 * Shows a warning alert if the contact is blacklisted.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} props.route.params.contactId - The contact ID to display.
 * @returns {React.ReactNode} ContactDetails component
 */
export const ContactDetails = ({ route }) => {
	const { contactId } = route.params;

	const walletController = useWalletController();
	const { networkIdentifier, chainName } = walletController;
	const { addressBook } = walletController.modules;

	// Contact data
	const contact = addressBook.getContactById(contactId);
	const { address, name, notes, isBlackListed } = contact;

	// Notes
	const isNotesVisible = notes?.length > 0;

	// Alert for blacklisted contact
	const blacklistAlert = createBlacklistAlertData(isBlackListed);

	// Send button
	const openSendScreen = () => Router.goToSend({
		params: {
			chainName,
			recipientAddress: address
		}
	});

	// Block explorer
	const explorerUrl = createExplorerAccountUrl(
		chainName,
		networkIdentifier,
		address
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	// Edit contact
	const openEditContact = () => {
		Router.goToEditContact({
			params: {
				contactId
			}
		});
	};

	// Remove contact
	const removeManager = useAsyncManager({
		callback: async () => addressBook.removeContact(contactId),
		onSuccess: () => Router.goBack()
	});
	const handleRemove = () => {
		removeManager.call();
	};

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						<Card>
							<Spacer>
								<Stack gap="m">
									<Stack gap="s">
										<FlexContainer center>
											<AccountAvatar address={address} size="l" />
											<StyledText type="title" size="s">
												{name}
											</StyledText>
										</FlexContainer>
										{blacklistAlert.isVisible && (
											<Alert
												variant={blacklistAlert.variant}
												body={blacklistAlert.text}
											/>
										)}
									</Stack>
									<Divider accent />
									<Field title={$t('fieldTitle_address')}>
										<CopyButtonContainer value={address} isStretched>
											<StyledText>
												{address}
											</StyledText>
										</CopyButtonContainer>
									</Field>
									{isNotesVisible && (
										<Field title={$t('fieldTitle_notes')}>
											<StyledText>
												{notes}
											</StyledText>
										</Field>
									)}
								</Stack>
							</Spacer>
						</Card>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<ButtonPlain
							icon="send-plane"
							text={$t('button_sendTransactionToThisAccount')}
							onPress={openSendScreen}
						/>
						<ButtonPlain
							icon="block-explorer"
							text={$t('button_openTransactionInExplorer')}
							onPress={openBlockExplorer}
						/>
						<ButtonPlain
							icon="edit"
							text={$t('button_edit')}
							onPress={openEditContact}
						/>
						<Divider />
						<Button
							variant="danger"
							text={$t('button_remove')}
							isDisabled={removeManager.isLoading}
							onPress={handleRemove}
						/>
					</Stack>
				</Spacer>
			</Screen.Bottom>
		</Screen>
	);
};
