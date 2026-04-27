import {
	AccountInfoCard,
	Button,
	ButtonPlain,
	DialogBox,
	Divider,
	PasscodeView,
	Screen,
	SendReceiveButtons,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { usePasscode, useToggle, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { TokenListItem } from '@/app/screens/assets/components';
import { createAccountAddressQr, createExplorerAccountUrl } from '@/app/utils';
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

	// Send/Receive buttons
	const receiveQrData = createAccountAddressQr({
		address: currentAccount.address,
		chainName,
		networkIdentifier
	});
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
		Router.goToTokenDetails({ params: { chainName, tokenId: token.id, preloadedData: token } });
	};

	return (
		<Screen refresh={{ onRefresh: refresh }}>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<AccountInfoCard
							address={currentAccount.address}
							name={currentAccount.name}
							chainName={chainName}
						/>
						<SendReceiveButtons
							accountAddress={currentAccount.address}
							chainName={chainName}
							receiveQrData={receiveQrData}
							onSendPress={openSendScreen}
						/>
						<Stack gap="s">
							<StyledText type="title">
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
