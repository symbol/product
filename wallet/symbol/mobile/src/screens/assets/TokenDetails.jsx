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
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { ExpirationProgress } from '@/app/screens/assets/components';
import { getExpirationData, getTokenDisplayInfo } from '@/app/screens/assets/utils';
import { Colors } from '@/app/styles';
import React from 'react';

/**
 * TokenDetails screen component. Displays detailed information about a specific token including
 * balance, creator, supply, divisibility, and expiration status. Allows sending tokens if not expired.
 * @param {{ route: { params: { chainName: string, tokenId: string } } }} props - Component props
 * @returns {React.ReactNode} TokenDetails component
 */
export const TokenDetails = ({ route }) => {
	const { chainName, tokenId } = route.params;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, currentAccount, currentAccountInfo, networkProperties } = walletController;

	// Find token in wallet
	const tokens = currentAccountInfo?.tokens || currentAccountInfo?.mosaics || [];
	const token = tokens.find(t => t.id === tokenId);

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

	if (token.creator === currentAccount.address) {
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
	const openSendScreen = () => Router.goToSend({ params: { chainName, tokenId } });

	// Refresh data
	const refresh = () => walletController.fetchAccountInfo();

	const isSendButtonDisabled = isTokenExpired;

	return (
		<Screen refresh={{ onRefresh: refresh }}>
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
