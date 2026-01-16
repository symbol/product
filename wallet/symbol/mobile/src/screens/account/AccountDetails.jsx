import {  ButtonPlain, Card, DialogBox, PasscodeView, Screen, Spacer } from '@/app/components';
import { TableView } from '@/app/components/data/TableView';
import { config } from '@/app/config';
import { usePasscode, useToggle, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { createExplorerAccountUrl } from '@/app/utils';
import React, { useState } from 'react';
import { constants } from 'wallet-common-core';

export const AccountDetails = () => {
	const walletController = useWalletController(chainName);
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
			title: 'address',
			value: currentAccount.address,
			type: 'copy'
		},
		{
			title: 'publicKey',
			value: currentAccount.publicKey,
			type: 'copy'
		},
		{
			title: 'chainName',
			value: chainName,
			type: 'text'
		},
		{
			title: 'networkIdentifier',
			value: currentAccount.networkIdentifier,
			type: 'text'
		},
		{
			title: 'name',
			value: currentAccount.name,
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
					<Card>
						<Spacer>
							<TableView
								data={tableData}
								addressBook={walletController.modules.addressBook}
								walletAccounts={walletController.accounts[networkIdentifier]}
								chainName={chainName}
								networkIdentifier={networkIdentifier}
								translate={$t}
								isTitleTranslatable
							/>
						</Spacer>
					</Card>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
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
				</Spacer>
				<DialogBox
					type="alert"
					title={$t('dialog_sensitive')}
					text={privateKey}
					isVisible={isPrivateKeyDialogShown}
					onSuccess={togglePrivateKeyDialog}
				/>
				<PasscodeView {...privateKeyPasscode.props} />
			</Screen.Bottom>
		</Screen >
	);
};
