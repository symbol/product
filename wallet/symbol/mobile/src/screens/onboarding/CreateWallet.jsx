import { generateMnemonic } from './utils/mnemonic';
import {
	Button,
	ButtonClose,
	Checkbox,
	FlexContainer,
	MnemonicView,
	PasscodeView,
	Screen,
	Spacer,
	Stack,
	StyledText,
	SymbolLogo,
	TextBox
} from '@/app/components';
import { MAX_SEED_ACCOUNTS_PER_NETWORK } from '@/app/constants';
import { useAsyncManager, usePasscode, useToggle, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { Steps } from '@/app/screens/onboarding/components/Steps';
import { WalletCreationAnimation } from '@/app/screens/onboarding/components/WalletCreationAnimation';
import { validateAccountName, validateRequired } from '@/app/utils';
import React, { useEffect, useState } from 'react';

const STEPS_COUNT = 2;

export const CreateWallet = () => {
	const walletController = useWalletController();

	// Step state
	const [step, setStep] = useState(1);

	// Account name state
	const [name, setName] = useState($t('screen_onboarding_title_defaultAccountName'));
	const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName()], $t);

	// Mnemonic state
	const [mnemonic, setMnemonic] = useState('');
	const [isMnemonicShown, setIsMnemonicShown] = useState(false);
	const [isRiskAccepted, toggleAcceptRisk] = useToggle(false);

	// UI loading steps
	const [isLoading, setIsLoading] = useState(false);
	const [loadingStep, setLoadingStep] = useState(1);
	const steps = [
		$t('screen_onboarding_loading_step_saveMnemonic'),
		$t('screen_onboarding_loading_step_setUpPin'),
		$t('screen_onboarding_loading_step_generateAccount'),
		$t('screen_onboarding_loading_step_done')
	];

	// Save mnemonic in the wallet
	const saveMnemonicManager = useAsyncManager({
		callback: async () => {
			await walletController.saveMnemonicAndGenerateAccounts({
				mnemonic,
				name,
				accountPerNetworkCount: MAX_SEED_ACCOUNTS_PER_NETWORK
			});
		},
		onSuccess: () => {
			setLoadingStep(4);
		}
	});

	// Start loading flow
	const startLoading = () => {
		setIsLoading(true);
		setTimeout(() => setLoadingStep(2), 500);
		setTimeout(() => setLoadingStep(3), 1000);
		setTimeout(saveMnemonicManager.call, 1500);
	};

	// Initiate the flow by creating a passcode
	const passcode = usePasscode({ onSuccess: startLoading }, 'create');

	// Navigation handlers
	const showMnemonic = () => setIsMnemonicShown(true);
	const handleNextPress = () => {
		if (step === STEPS_COUNT) 
			passcode.show();
		else 
			setStep(step + 1);
	};

	// Generate mnemonic on mount
	useEffect(() => {
		const generatedMnemonic = generateMnemonic();
		setMnemonic(generatedMnemonic);
	}, []);

	// Button disabled states
	const isStep1ButtonDisabled = !!nameErrorMessage;
	const isStep2ButtonDisabled = !isRiskAccepted;

	return (
		<Screen
			isLoading={isLoading}
			renderLoading={() => <WalletCreationAnimation steps={steps} currentStep={loadingStep} />}
		>
			<Screen.Upper>
				<Spacer>
					<FlexContainer right>
						<ButtonClose text={$t('button_cancel')} onPress={Router.goBack} />
					</FlexContainer>
					<Stack gap="xl">
						<Stack>
							<FlexContainer center>
								<SymbolLogo />
							</FlexContainer>
							<Steps stepsCount={STEPS_COUNT} currentStep={step} />
						</Stack>

						{step === 1 && (
							<Stack>
								<StyledText type="title">
									{$t('screen_onboarding_title_accountName')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_description_accountName')}
								</StyledText>
								<TextBox
									label={$t('screen_onboarding_inputLabel_accountName')}
									value={name}
									errorMessage={nameErrorMessage}
									onChange={setName}
								/>
							</Stack>
						)}

						{step === 2 && (
							<Stack>
								<StyledText type="title">
									{$t('screen_onboarding_title_mnemonic')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_mnemonic_description_backupAndRestore')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_mnemonic_description_neverDisclose')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_mnemonic_description_noRecovery')}
								</StyledText>
								<MnemonicView
									mnemonic={mnemonic}
									isShown={isMnemonicShown}
									onShowPress={showMnemonic}
								/>
								<StyledText type="title">
									{$t('screen_onboarding_title_tips')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_tips_description_passwordManager')}
								</StyledText>
								<StyledText>
									{$t('screen_onboarding_tips_description_paper')}
								</StyledText>
								<StyledText type="title">
									{$t('screen_onboarding_title_confirm')}
								</StyledText>
								<Checkbox
									text={$t('screen_onboarding_checkbox_acceptRisk')}
									value={isRiskAccepted}
									onChange={toggleAcceptRisk}
								/>
							</Stack>
						)}
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Button
						isDisabled={step === 1 ? isStep1ButtonDisabled : isStep2ButtonDisabled}
						text={$t('button_next')}
						onPress={handleNextPress}
					/>
				</Spacer>
				<PasscodeView {...passcode.props} />
			</Screen.Bottom>
		</Screen>
	);
};
