import { 
	AccountInfoCard, 
	ButtonPlain, 
	Card, 
	DialogBox, 
	Divider, 
	PasscodeView, 
	Screen, 
	SendReceiveButtons, 
	Spacer, 
	Stack, 
	StyledText, 
	TableView 
} from '@/app/components';
import { config } from '@/app/config';
import { usePasscode, useToggle, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { createAccountAddressQr, createExplorerAccountUrl } from '@/app/utils';
import React, { useState } from 'react';
import { constants } from 'wallet-common-core';

/**
 * AccountDetails screen component. A screen displaying detailed information about the currently
 * selected wallet account, including address, public key, and account type, with options to view
 * in block explorer, access faucet on testnet, and reveal private key.
 */
export const AccountDetails = () => {
	const walletController = useWalletController();
	const { chainName, networkIdentifier, currentAccount, currentAccountInfo } = walletController;
	const isTestnet = networkIdentifier === 'testnet';
	const isMultisigCosigner = currentAccountInfo?.multisigAddresses.length;

	// Block explorer
	const explorerUrl = createExplorerAccountUrl(
		chainName,
		networkIdentifier,
		currentAccount.address
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	// Faucet
	const faucetUrl = `${config.faucetURL}/?recipient=${currentAccount.address}`;
	const openFaucet = () => PlatformUtils.openLink(faucetUrl);

	// Send/Receive buttons
	const receiveQrData = createAccountAddressQr({
		address: currentAccount.address,
		chainName,
		networkIdentifier
	});
	const hasMultisigSendWarning = currentAccountInfo?.isMultisig;

	// Private key reveal
	const [isPrivateKeyDialogShown, togglePrivateKeyDialog] = useToggle(false);
	const [privateKey, setPrivateKey] = useState('');
	const revealPrivateKey = async () => {
		const privateKey = await walletController.getCurrentAccountPrivateKey();
		setPrivateKey(privateKey);
		togglePrivateKeyDialog();
	};
	const privateKeyPasscode = usePasscode({ onSuccess: revealPrivateKey });

	// Info table data
	const tableData = [
		{
			title: 'publicKey',
			value: currentAccount.publicKey,
			type: 'copy'
		},
		{
			title: 'networkIdentifier',
			value: currentAccount.networkIdentifier,
			type: 'text'
		},
		{
			title: 'accountType',
			value: currentAccount.accountType,
			type: 'text'
		}
	];

	if (currentAccount.accountType === constants.WalletAccountType.MNEMONIC) {
		tableData.push({
			title: 'seedIndex',
			value: currentAccount.index,
			type: 'text'
		});
	}

	if (isMultisigCosigner) {
		tableData.push({
			title: 'multisigAddresses',
			value: currentAccountInfo.multisigAddresses,
			type: 'account'
		});
	}

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
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
								onSendPress={Router.goToSend}
								hasMultisigSendWarning={hasMultisigSendWarning}
							/>
						</Stack>
						<Stack gap="s">
							<StyledText type="title">
								{$t('s_accountDetails_accountInfo_title')}
							</StyledText>
							<Card>
								<Spacer>
									<TableView
										data={tableData}
										addressBook={walletController.modules.addressBook}
										walletAccounts={walletController.accounts}
										chainName={chainName}
										networkIdentifier={networkIdentifier}
										translate={$t}
										isTitleTranslatable
									/>
								</Spacer>
							</Card>
						</Stack>
						<Divider />
						<Stack>
							{isTestnet && (
								<ButtonPlain
									icon="faucet"
									text={$t('button_faucet')}
									onPress={openFaucet}
								/>
							)}
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
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Modals>
				<DialogBox
					type="alert"
					title={$t('dialog_sensitive')}
					text={privateKey}
					isVisible={isPrivateKeyDialogShown}
					onSuccess={togglePrivateKeyDialog}
				/>
				<PasscodeView {...privateKeyPasscode.props} />
			</Screen.Modals>
		</Screen >
	);
};
