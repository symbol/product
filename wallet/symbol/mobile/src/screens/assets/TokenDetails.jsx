import {
	Alert,
	Amount,
	Button,
	Card,
	Divider,
	Field,
	FlexContainer,
	Screen,
	Spacer,
	Stack,
	StyledText,
	TableView,
	TokenAvatar
} from '@/app/components';
import { useAsyncManager, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { ExpirationProgress } from '@/app/screens/assets/components';
import { getExpirationData, getTokenDisplayInfo } from '@/app/screens/assets/utils';
import { Colors } from '@/app/styles';
import React from 'react';

/**
 * TokenDetails screen component. Displays detailed information about a specific token including
 * balance, creator, supply, divisibility, and expiration status. Allows sending tokens if not expired.
 *
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {string} props.route.params.chainName - The blockchain name.
 * @param {string} props.route.params.tokenId - The token identifier.
 * @param {string} props.route.params.accountAddress - The owner account address.
 * @param {object} [props.route.params.preloadedData] - Preloaded token data to avoid initial fetch.
 *
 * @returns {React.ReactNode} TokenDetails component
 */
export const TokenDetails = ({ route }) => {
	const { chainName, tokenId, accountAddress, preloadedData } = route.params;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, networkProperties } = walletController;

	// Fetch data
	const dataManager = useAsyncManager({
		callback: async () => {
			const accountInfo = await walletController.networkApi.account.fetchAccountInfo(networkProperties, accountAddress);

			const tokens = accountInfo.tokens ?? accountInfo.mosaics ?? [];
			
			return tokens.find(token => token.id === tokenId);
		},
		defaultData: preloadedData
	});
	const token = dataManager.data;

	// Token display data
	const {
		name,
		ticker,
		imageId
	} = getTokenDisplayInfo(token, chainName, networkIdentifier);

	// Info table data
	const tableData = [
		{
			title: 'id',
			value: token.id,
			type: 'copy'
		},
		{
			title: 'chainName',
			value: chainName,
			type: 'text'
		}
	];

	if (token.creator === accountAddress) {
		tableData.push({
			title: 'supply',
			value: token.supply,
			type: 'text'
		});
		tableData.push({
			title: 'divisibility',
			value: token.divisibility,
			type: 'text'
		});
	};

	if (token.creator) {
		tableData.push({
			title: 'creator',
			value: token.creator,
			type: 'account'
		});
	};

	// Expiration data
	const {
		isTokenExpired,
		isExpirationSectionShown,
		isAlertVisible,
		alertVariant,
		alertText
	} = getExpirationData(token, networkProperties);

	// Send button
	const openSendScreen = () => Router.goToSend({ params: { 
		chainName, 
		tokenId,
		senderAddress: accountAddress 
	}});

	const isSendButtonDisabled = isTokenExpired;

	return (
		<Screen refresh={{ onRefresh: dataManager.call, isRefreshing: dataManager.isLoading }}>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<Card>
							<Spacer>
								<Stack>
									<FlexContainer center>
										<TokenAvatar imageId={imageId} size="l" />
										<StyledText type="title" size="s">
											{name}
										</StyledText>
									</FlexContainer>
									<Divider color={Colors.Semantic.background.tertiary.lighter} />
									<Field title={$t('fieldTitle_balance')}>
										<Amount size="l" value={token.amount} ticker={ticker} />
									</Field>
								</Stack>
							</Spacer>
						</Card>
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
						{isExpirationSectionShown && (
							<Card>
								<Spacer>
									<Stack>
										<ExpirationProgress
											startHeight={token.startHeight}
											endHeight={token.endHeight}
											chainHeight={networkProperties?.chainHeight ?? 0}
											blockGenerationTargetTime={networkProperties?.blockGenerationTargetTime ?? 0}
										/>
										<Alert
											variant={alertVariant}
											body={alertText}
											isVisible={isAlertVisible}
										/>
										<Field title={$t('fieldTitle_registrationHeight')}>
											<StyledText>
												{token.startHeight}
											</StyledText>
										</Field>
										<Field title={$t('fieldTitle_currentChainHeight')}>
											<StyledText>
												{networkProperties.chainHeight}
											</StyledText>
										</Field>
										<Field title={$t('fieldTitle_expirationHeight')}>
											<StyledText>
												{token.endHeight}
											</StyledText>
										</Field>
									</Stack>
								</Spacer>
							</Card>
						)}
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<Button
							isDisabled={isSendButtonDisabled}
							text={$t('button_send')}
							onPress={openSendScreen}
						/>
					</Stack>
				</Spacer>
			</Screen.Bottom>
		</Screen>
	);
};
