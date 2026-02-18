import { ButtonClose, Icon, LoadingIndicator, Spacer } from '@/app/components';
import { passcodeManager } from '@/app/lib/passcode';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import PINCode from '@haskkor/react-native-pincode';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const EnterType = {
	CREATE: 'create',
	VERIFY: 'verify'
};
const MAX_ATTEMPTS = 10;

/**
 * Passcode component. A component for creating or verifying a numeric passcode using a PIN entry
 * interface, with support for maximum attempts and custom styling.
 *
 * @param {object} props - The component props.
 * @param {'create' | 'verify'} [props.type] The type of passcode
 * @param {function} props.onSuccess The success callback.
 * @param {function} [props.onCancel] The cancel callback.
 * 
 * @returns {React.ReactNode} The passcode component.
 */
export const Passcode = props => {
	const { type = EnterType.VERIFY, onSuccess, onCancel } = props;
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadStatus = async () => {
			const isPasscodeEnabled = await passcodeManager.isPasscodeSet();
			if (!isPasscodeEnabled && type === EnterType.VERIFY)
				onSuccess();
			else
				setIsLoading(false);
		};
		loadStatus();
	}, []);

	return (
		<View style={styles.root}>
			{!isLoading && (
				<>
					<PINCode
						status={type === EnterType.VERIFY ? 'enter' : 'choose'}
						titleEnter={$t('s_passcode_titleEnter')}
						titleChoose={$t('s_passcode_titleChoose')}
						subtitleChoose={$t('s_passcode_subtitleChoose')}
						titleConfirm={$t('s_passcode_titleConfirm')}
						subtitleConfirm={$t('s_passcode_subtitleConfirm')}
						titleAttemptFailed={$t('s_passcode_titleAttemptFailed')}
						subtitleError={$t('s_passcode_subtitleError')}
						maxAttempts={MAX_ATTEMPTS}
						stylePinCodeTextTitle={Typography.Semantic.title.m}
						stylePinCodeTextSubtitle={Typography.Semantic.body.m}
						stylePinCodeColorTitle={Colors.Components.main.text}
						stylePinCodeColorTitleError={Colors.Semantic.role.danger.default}
						stylePinCodeColorSubtitle={Colors.Components.main.text}
						stylePinCodeColorSubtitleError={Colors.Semantic.role.danger.default}
						stylePinCodeButtonNumber={Colors.Components.buttonSolid.secondary.default.text}
						styleMainContainer={styles.styleMainContainer}
						stylePinCodeTextButtonCircle={Typography.Semantic.button.m}
						numbersButtonOverlayColor={Colors.Semantic.role.neutral.default}
						colorCircleButtons={Colors.Components.buttonSolid.secondary.default.background}
						colorPassword={Colors.Semantic.role.secondary.default}
						buttonDeleteText="Delete"
						stylePinCodeDeleteButtonText={Typography.Semantic.button.m}
						stylePinCodeColumnDeleteButton={styles.buttonDelete}
						styleLockScreenColorIcon={styles.buttonDelete}
						customBackSpaceIcon={() => (	
							<Icon 
								name="backspace" 
								size="l" 
								variant="secondary"
								style={styles.buttonBackspace}
							/>
						)}
						finishProcess={onSuccess}
						touchIDDisabled={type === EnterType.CREATE}
					/>
					{!!onCancel && (
						<ButtonClose
							text={$t('button_cancel')}
							style={styles.buttonCancel}
							onPress={onCancel}
						/>
					)}
				</>
			)}
			{isLoading && <LoadingIndicator />}
		</View>
	);
};

export const PasscodeView = ({ isVisible, type, onSuccess, onCancel }) => {
	if (!isVisible)
		return null;

	return (
		<Modal isVisible>
			<SafeAreaProvider>
				<SafeAreaView style={styles.safeArea}>
					<Spacer style={styles.spacer}>
						<Passcode type={type} onSuccess={onSuccess} onCancel={onCancel} />;
					</Spacer>
				</SafeAreaView>
			</SafeAreaProvider>
		</Modal>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: Colors.Components.passcode.background
	},
	spacer: {
		flex: 1
	},
	root: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: Colors.Components.passcode.background
	},
	styleMainContainer: {
		backgroundColor: Colors.Components.passcode.background
	},
	buttonCancel: {
		position: 'absolute',
		right: Sizes.Semantic.spacing.s,
		top: Sizes.Semantic.spacing.s
	},
	buttonBackspace: {
		height: '100%',
		margin: 'auto',
		resizeMode: 'contain'
	}
});
