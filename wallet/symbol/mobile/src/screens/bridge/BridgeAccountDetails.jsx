import {
	Button,
	ButtonPlain,
	Card,
	CopyButtonContainer,
	DialogBox,
	Divider,
	Field,
	PasscodeView,
	Screen,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { usePasscode, useToggle, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { TokenListItem } from '@/app/screens/assets/components';
import { createExplorerAccountUrl } from '@/app/utils';
import React, { useState } from 'react';

/**
 * BridgeAccountDetails screen component. A screen displaying detailed information about the bridge
 * wallet account (external network), including address, public key, and account type, with options to view
 * in block explorer and reveal private key.
 */
export const BridgeAccountDetails = ({ route }) => {
	const { chainName } = route.params;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, currentAccount, currentAccountInfo } = walletController;
	const tokens = currentAccountInfo?.tokens || currentAccountInfo?.mosaics || [];

	// Send button
	const openSendScreen = () => Router.goToSend({ params: { chainName } });

	// Block explorer
	const explorerUrl = createExplorerAccountUrl(
		chainName,
		networkIdentifier,
		currentAccount.address
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	// Private key reveal
	const [isPrivateKeyDialogShown, togglePrivateKeyDialog] = useToggle(false);
	const [privateKey, setPrivateKey] = useState('');
	const revealPrivateKey = async () => {
		const privateKey = await walletController.getCurrentAccountPrivateKey();
		setPrivateKey(privateKey);
		togglePrivateKeyDialog();
	};
	const privateKeyPasscode = usePasscode({ onSuccess: revealPrivateKey });

	// Remove account
	const [isRemoveConfirmVisible, toggleRemoveConfirm] = useToggle(false);
	const handleConfirmRemove = () => {
		Router.goBack();
		walletController.clear();
		toggleRemoveConfirm();
	};

	// Refresh data
	const refresh = () => walletController.fetchAccountInfo();

	// Handlers
	const handleTokenPress = token => {
		Router.goToTokenDetails({ params: { chainName, tokenId: token.id } });
	};

	return (
		<Screen refresh={{ onRefresh: refresh }}>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<Card>
							<Spacer>
								<Stack>
									<Field title={$t('fieldTitle_chainName')}>
										<StyledText type="title">
											{chainName}
										</StyledText>
									</Field>
									<Field title={$t('fieldTitle_address')}>
										<CopyButtonContainer value={currentAccount.address} isStretched>
											<StyledText>
												{currentAccount.address}
											</StyledText>
										</CopyButtonContainer>
									</Field>
								</Stack>
							</Spacer>
						</Card>
						<Stack gap="s">
							<StyledText type="label">
								{$t('s_bridge_tokens_title')}
							</StyledText>
							{tokens.map(token => (
								<TokenListItem
									key={token.id}
									token={token}
									chainName={chainName}
									networkIdentifier={networkIdentifier}
									onPress={handleTokenPress}
								/>
							))}
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<ButtonPlain
							icon="send-plane"
							text={$t('button_sendTransferTransaction')}
							onPress={openSendScreen}
						/>
						<ButtonPlain
							icon="block-explorer"
							text={$t('button_openTransactionInExplorer')}
							onPress={openBlockExplorer}
						/>
						<ButtonPlain
							icon="key"
							text={$t('button_revealPrivateKey')}
							onPress={() => privateKeyPasscode.show()}
						/>
						<Divider />
						<Button
							variant="danger"
							text={$t('button_removeAccount')}
							onPress={toggleRemoveConfirm}
						/>
					</Stack>
				</Spacer>
			</Screen.Bottom>
			<Screen.Modals>
				<DialogBox
					type="alert"
					title={$t('dialog_sensitive')}
					text={privateKey}
					isVisible={isPrivateKeyDialogShown}
					onSuccess={togglePrivateKeyDialog}
				/>
				<DialogBox
					type="confirm"
					title={$t('dialog_removeAccount_title')}
					text={$t('dialog_removeAccount_body', { name: chainName, address: currentAccount.address })}
					isVisible={isRemoveConfirmVisible}
					onSuccess={handleConfirmRemove}
					onCancel={toggleRemoveConfirm}
				/>
				<PasscodeView {...privateKeyPasscode.props} />
			</Screen.Modals>
		</Screen >
	);
};
