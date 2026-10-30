import { AppLogo, Button, ButtonPlain, Screen, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/screens/onboarding/types/Onboarding').WelcomeViewProps} WelcomeViewProps */

/**
 * WelcomeView component. Represents the Welcome screen for this brand. Used in the common Welcome screen.
 * @param {WelcomeViewProps} props - Component props.
 * @returns {React.ReactNode} WelcomeView component.
 */
export const WelcomeView = props => {
	const { onCreateWalletPress, onImportWalletPress } = props;

	return (
		<Screen backgroundImageSrc={require('../../../assets/images/art/welcome.png')}>
			<Screen.Upper>
				<Spacer top='xxl'>
					<Stack>
						<AppLogo />
						<StyledText type="title" size="l">
							{$t('screen_onboarding_title_welcome')}
						</StyledText>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<Button text={$t('button_walletCreate')} onPress={onCreateWalletPress} />
						<ButtonPlain icon="block-explorer" text={$t('button_walletImport')} isCentered onPress={onImportWalletPress} />
					</Stack>
				</Spacer>
			</Screen.Bottom>
		</Screen>
	);
};
