import {
	AccountInfoCard,
	ButtonPlain,
	Card,
	Divider,
	EmptyListMessage,
	Field,
	Screen,
	SendReceiveButtons,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { useAsyncManager, useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { TokenListItem } from '@/app/screens/assets/components';
import { CosignatoryList, CosignatureCounter } from '@/app/screens/multisig/components';
import { createAccountAddressQr, createAccountDisplayData, createExplorerAccountUrl } from '@/app/utils';
import React from 'react';

/**
 * Returns the display name for a multisig account.
 * @param {string|null} name - The account name from address book or wallet.
 * @returns {string} The display name.
 */
const getAccountNameText = name => {
	return name ?? $t('s_multisig_defaultAccountName');
};

/**
 * MultisigAccountDetails screen component. Displays details of a multisig account including
 * address, approval thresholds, cosignatories, and token balances. Provides navigation to
 * send transactions, block explorer, and account modification.
 *
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {string} props.route.params.chainName - The blockchain name.
 * @param {string} props.route.params.accountAddress - The multisig account address.
 * @param {object} [props.route.params.preloadedData] - Preloaded account data to avoid initial fetch.
 *
 * @returns {React.ReactNode} MultisigAccountDetails component
 */
export const MultisigAccountDetails = ({ route }) => {
	const { chainName, accountAddress, preloadedData } = route.params;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, accounts } = walletController;
	const walletAccounts = accounts[networkIdentifier];
	const { addressBook, multisig: multisigModule } = walletController.modules;

	// Fetch multisig account data
	const dataManager = useAsyncManager({
		callback: async () => multisigModule.fetchAccountInfo(accountAddress),
		defaultData: preloadedData
	});
	const { data } = dataManager;

	// Account info
	const { address, minApproval, minRemoval, cosignatories } = data;
	const accountDisplay = createAccountDisplayData(address, {
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier
	});
	const accountNameText = getAccountNameText(accountDisplay.name);

	// Tokens
	const tokens = data?.tokens || data?.mosaics || [];

	// Send/Receive buttons
	const receiveQrData = createAccountAddressQr({
		address,
		chainName,
		networkIdentifier
	});
	const openSendScreen = () => Router.goToSend({
		params: {
			chainName,
			senderAddress: address
		}
	});

	// Block explorer
	const explorerUrl = createExplorerAccountUrl(
		chainName,
		networkIdentifier,
		address
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	// Modify account
	const openModifyScreen = () => Router.goToModifyMultisigAccount({
		params: {
			chainName,
			accountAddress,
			preloadedData: data
		}
	});

	// Handlers
	const handleTokenPress = token => {
		Router.goToTokenDetails({ params: { chainName, tokenId: token.id, accountAddress: address, preloadedData: token } });
	};

	return (
		<Screen refresh={{ onRefresh: dataManager.call, isRefreshing: dataManager.isLoading }}>
			<Spacer>
				<Stack gap="l">
					<Stack>
						<AccountInfoCard
							address={address}
							name={accountNameText}
							chainName={chainName}
							imageId={accountDisplay.imageId}
						/>
						<SendReceiveButtons
							accountAddress={address}
							chainName={chainName}
							receiveQrData={receiveQrData}
							onSendPress={openSendScreen}
						/>
					</Stack>
					<Stack gap="s">
						<StyledText type="title">
							{$t('s_multisig_multisigInfo_title')}
						</StyledText>
						<Card>
							<Spacer>
								<Stack>
									<Field title={$t('fieldTitle_minApprovals')}>
										<CosignatureCounter
											variant="min-approval"
											value={minApproval}
											total={cosignatories.length}
										/>
									</Field>
									<Field title={$t('fieldTitle_minRemovals')}>
										<CosignatureCounter
											variant="min-removal"
											value={minRemoval}
											total={cosignatories.length}
										/>
									</Field>
									<Field title={$t('fieldTitle_accountCosignatories')}>
										<CosignatoryList
											cosignatories={cosignatories}
											chainName={chainName}
											networkIdentifier={networkIdentifier}
											walletAccounts={walletAccounts}
											addressBook={addressBook}
										/>
									</Field>
								</Stack>
							</Spacer>
						</Card>
					</Stack>
					<Stack gap="s">
						<StyledText type="title">
							{$t('s_multisig_tokens_title')}
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
						{tokens.length === 0 && (
							<EmptyListMessage />
						)}
					</Stack>
					<Divider />
					<ButtonPlain
						icon="block-explorer"
						text={$t('button_openTransactionInExplorer')}
						onPress={openBlockExplorer}
					/>
					<ButtonPlain
						icon="edit"
						text={$t('button_modifyAccount')}
						onPress={openModifyScreen}
					/>
				</Stack>
			</Spacer>
		</Screen >
	);
};
