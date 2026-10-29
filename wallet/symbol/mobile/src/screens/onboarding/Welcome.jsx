import { DialogBox, Stack, StyledText } from '@/app/components';
import { termsAndPrivacy } from '@/app/config';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { WelcomeView } from '@/brand/screens/onboarding/components/WelcomeView';

export const Welcome = () => {
	const [isTermsAndPrivacyShown, toggleTermsAndPrivacy] = useToggle(true);

	const createWallet = Router.goToCreateWallet;
	const importWallet = Router.goToImportWallet;

	return (
		<>
			<WelcomeView onCreateWalletPress={createWallet} onImportWalletPress={importWallet} />
			<DialogBox
				type="accept"
				isVisible={isTermsAndPrivacyShown}
				onSuccess={toggleTermsAndPrivacy}
				title={$t('screen_onboarding_dialog_termsAndPrivacy_title')}
			>
				<Stack gap="s">
					<StyledText type="title" size="s">{$t('screen_onboarding_title_termsAndConditions')}</StyledText>
					<StyledText type="body">{termsAndPrivacy.terms}</StyledText>
					<StyledText type="title" />
					<StyledText type="title" size="s">{$t('screen_onboarding_title_privacyPolicy')}</StyledText>
					<StyledText type="body">{termsAndPrivacy.privacy}</StyledText>
				</Stack>
			</DialogBox>
		</>
	);
};
