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
	const [name, setName] = useState($t('s_createWallet_defaultAccountName'));
	const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName()], $t);

	// Mnemonic state
	const [mnemonic, setMnemonic] = useState('');
	const [isMnemonicShown, setIsMnemonicShown] = useState(false);
	const [isRiskAccepted, toggleAcceptRisk] = useToggle(false);

	// UI loading steps
	const [isLoading, setIsLoading] = useState(false);
	const [loadingStep, setLoadingStep] = useState(1);
	const steps = [
		$t('s_createWallet_loading_step1'),
		$t('s_createWallet_loading_step2'),
		$t('s_createWallet_loading_step3'),
		$t('s_createWallet_loading_step4')
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
									{$t('s_createWallet_accountName_title')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_accountName_text')}
								</StyledText>
								<TextBox
									label={$t('s_createWallet_accountName_input')}
									value={name}
									errorMessage={nameErrorMessage}
									onChange={setName}
								/>
							</Stack>
						)}

						{step === 2 && (
							<Stack>
								<StyledText type="title">
									{$t('s_createWallet_mnemonic_title')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_mnemonic_text_p1')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_mnemonic_text_p2')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_mnemonic_text_p3')}
								</StyledText>
								<MnemonicView
									mnemonic={mnemonic}
									isShown={isMnemonicShown}
									onShowPress={showMnemonic}
								/>
								<StyledText type="title">
									{$t('s_createWallet_tips_title')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_tips_text_p1')}
								</StyledText>
								<StyledText>
									{$t('s_createWallet_tips_text_p2')}
								</StyledText>
								<StyledText type="title">
									{$t('s_createWallet_confirm_title')}
								</StyledText>
								<Checkbox
									text={$t('s_createWallet_confirm_checkbox')}
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
