import { Button, ButtonPlain, DialogBox, Screen, Spacer, Stack, StyledText, SymbolLogo } from '@/app/components';
import { termsAndPrivacy } from '@/app/config';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

export const Welcome = () => {
	const [isTermsAndPrivacyShown, toggleTermsAndPrivacy] = useToggle(true);

	const createWallet = Router.goToCreateWallet;
	const importWallet = Router.goToImportWallet;

	return (
		<Screen backgroundImageSrc={require('@/app/assets/images/art/welcome.png')}>
			<Screen.Upper>
				<Spacer top='xxl'>
					<Stack>
						<SymbolLogo />
						<StyledText type="title" size="l">
							{$t('s_welcome_wallet_title')}
						</StyledText>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<Button text={$t('button_walletCreate')} onPress={createWallet} />
						<ButtonPlain icon="block-explorer" text={$t('button_walletImport')} isCentered onPress={importWallet} />
					</Stack>
				</Spacer>
				<DialogBox
					type="accept"
					isVisible={isTermsAndPrivacyShown}
					onSuccess={toggleTermsAndPrivacy}
					title={$t('s_welcome_modal_title')}
				>
					<Stack gap="s">
						<StyledText type="title" size="s">{$t('s_welcome_modal_tnc')}</StyledText>
						<StyledText type="body">{termsAndPrivacy.terms}</StyledText>
						<StyledText type="title" />
						<StyledText type="title" size="s">{$t('s_welcome_modal_privacy')}</StyledText>
						<StyledText type="body">{termsAndPrivacy.privacy}</StyledText>
					</Stack>
				</DialogBox>
			</Screen.Bottom>
		</Screen >
	);
};
