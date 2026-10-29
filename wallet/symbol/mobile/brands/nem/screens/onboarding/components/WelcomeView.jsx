import { Button, ButtonPlain, Screen, Spacer, Stack } from '@/app/components';
import { $t } from '@/app/localization';
import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/onboarding/types/Onboarding').WelcomeViewProps} WelcomeViewProps */

const LOGO_SIZE = Sizes.Primitives.spacing1600;

/**
 * WelcomeView component. Represents the Welcome screen for this brand. Used in the common Welcome screen.
 * import wallet buttons.
 * @param {WelcomeViewProps} props - Component props.
 * @returns {React.ReactNode} WelcomeView component.
 */
export const WelcomeView = props => {
	const { onCreateWalletPress, onImportWalletPress } = props;

	return (
		<Screen isScrollDisabled backgroundImageSrc={require('../../../assets/images/art/welcome.png')}>
			<Screen.Upper>
				<View style={styles.content}>
					<Image source={require('../../../assets/images/art/nem-logo.png')} style={styles.logo} />
				</View>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Stack>
						<Button text={$t('button_walletCreate')} onPress={onCreateWalletPress} />
						<ButtonPlain text={$t('button_walletImport')} isCentered onPress={onImportWalletPress} />
					</Stack>
				</Spacer>
			</Screen.Bottom>
		</Screen>
	);
};

const styles = StyleSheet.create({
	content: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	logo: {
		width: LOGO_SIZE,
		height: LOGO_SIZE,
		marginTop: Sizes.Semantic.spacing.xl,
		resizeMode: 'contain'
	}
});
