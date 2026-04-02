import {
	AccountView,
	ButtonPlain,
	Card,
	CopyButtonContainer,
	Divider,
	Field,
	Spacer,
	Stack,
	StyledText,
	TokenView
} from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { SwapSideType } from '@/app/screens/bridge/types/Bridge';
import { Colors } from '@/app/styles';
import { createExplorerTransactionUrl } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSideTypeValue} SwapSideTypeValue */
/** @typedef {import('@/app/screens/bridge/types/Bridge').ResolvedTokenData} ResolvedTokenData */
/** @typedef {import('@/app/screens/bridge/types/Bridge').ResolvedAccountData} ResolvedAccountData */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * SwapSideDetails component. Displays detailed information for one side of a swap,
 * including token info, chain name, account address, and transaction hash with
 * copy functionality and block explorer link.
 * @param {Object} props - Component props.
 * @param {SwapSideTypeValue} props.type - The side type (source or target).
 * @param {string} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {ResolvedTokenData} props.token - Token information.
 * @param {ResolvedAccountData|null} props.account - Account information.
 * @param {string|null} props.transactionHash - The transaction hash.
 * @returns {import('react').ReactNode} SwapSideDetails component
 */
export const SwapSideDetails = ({ type, chainName, networkIdentifier, token, account, transactionHash }) => {
	const emptyValuePlaceholder = $t('data_v_na');

	// Account
	const isAccountVisible = !!account;
	const accountTitle = type === SwapSideType.SOURCE
		? $t('fieldTitle_senderAddress')
		: $t('fieldTitle_recipientAddress');

	// Token
	const tokenAmountText = token.amount ? token.amount : '..';

	// Transaction hash
	const isTransactionVisible = !!transactionHash;

	// Block explorer
	const explorerUrl = createExplorerTransactionUrl(
		chainName,
		networkIdentifier,
		transactionHash
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	return (
		<Card>
			<Spacer>
				<Stack>
					<TokenView
						name={token.name}
						ticker={token.ticker}
						imageId={token.imageId}
						amount={tokenAmountText}
						size="l"
					/>
					<Divider color={Colors.Semantic.background.tertiary.lighter} />
					<Field title={$t('fieldTitle_chainName')}>
						<StyledText>
							{chainName}
						</StyledText>
					</Field>
					<Field title={accountTitle}>
						{isAccountVisible ? (
							<CopyButtonContainer value={account.address} isStretched>
								<AccountView
									address={account.address}
									name={account.name}
									imageId={account.imageId}
								/>
							</CopyButtonContainer>
						) : (
							<StyledText>
								{emptyValuePlaceholder}
							</StyledText>
						)}
					</Field>
					<Field title={$t('fieldTitle_transactionHash')}>
						{isTransactionVisible ? (
							<CopyButtonContainer value={transactionHash} isStretched>
								<StyledText>
									{transactionHash}
								</StyledText>
							</CopyButtonContainer>
						) : (
							<StyledText>
								{emptyValuePlaceholder}
							</StyledText>
						)}
					</Field>
					{isTransactionVisible && (
						<ButtonPlain
							icon="block-explorer"
							text={$t('button_openTransactionInExplorer')}
							onPress={openBlockExplorer}
						/>
					)}
				</Stack>
			</Spacer>
		</Card>
	);
};
