import { getOptinAccountFromMnemonic } from './utils/optin';
import { Router } from '@/app/Router';
import { Button, ButtonClose, FlexContainer, PasscodeView, Screen, Spacer, Stack, StyledText, SymbolLogo } from '@/app/components';
import { MAX_SEED_ACCOUNTS_PER_NETWORK } from '@/app/constants';
import { useAsyncManager, usePasscode, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { MnemonicInput } from '@/app/screens/onboarding/components/MnemonicInput';
import { WalletCreationAnimation } from '@/app/screens/onboarding/components/WalletCreationAnimation';
import React, { useState } from 'react';

export const ImportWallet = () => {
	const walletController = useWalletController();
	const accountName = $t('s_importWallet_defaultAccountName');

	// UI loading steps
	const [isLoading, setIsLoading] = useState(false);
	const [loadingStep, setLoadingStep] = useState(1);
	const steps = [
		$t('s_importWallet_loading_step1'),
		$t('s_importWallet_loading_step2'),
		$t('s_importWallet_loading_step3'),
		$t('s_importWallet_loading_step4'),
		$t('s_importWallet_loading_step5')
	];

	// Mnemonic state
	const [mnemonic, setMnemonic] = useState('');
	const [isMnemonicValid, setIsMnemonicValid] = useState(false);

	// Save mnemonic in the wallet
	const saveMnemonicManager = useAsyncManager({
		callback: async () => {
			await walletController.saveMnemonicAndGenerateAccounts({
				mnemonic: mnemonic.trim(),
				name: accountName,
				accountPerNetworkCount: MAX_SEED_ACCOUNTS_PER_NETWORK
			});
			if (optinManager.data) {
				await walletController.addExternalAccount({
					privateKey: optinManager.data.privateKey,
					name: 'Opt-in Account',
					networkIdentifier: NetworkIdentifier.MAIN_NET
				});
			}
		},
		onSuccess: () => {
			setLoadingStep(5);
		}
	});

	// Check if the mnemonic corresponds to an opt-in account
	const optinManager = useAsyncManager({
		callback: () => getOptinAccountFromMnemonic(mnemonic),
		onSuccess: () => {
			setLoadingStep(4);
			setTimeout(() => {
				saveMnemonicManager.call();
			}, 500);
		}
	});

	// Start loading flow
	const startLoading = () => {
		setIsLoading(true);
		setTimeout(() => setLoadingStep(2), 500);
		setTimeout(() => setLoadingStep(3), 1000);
		setTimeout(optinManager.call, 1500);
	};

	// Initiate the flow by creating a passcode
	const passcode = usePasscode({ onSuccess: startLoading }, 'create');
	const handleButtonPress = () => {
		passcode.show();
	};

	const isButtonDisabled = !isMnemonicValid;

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
					<Stack>
						<FlexContainer center>
							<SymbolLogo />
						</FlexContainer>
						<StyledText type="title">
							{$t('s_importWallet_title')}
						</StyledText>
						<StyledText>
							{$t('s_importWallet_text')}
						</StyledText>
						<MnemonicInput
							label={$t('input_mnemonic')}
							value={mnemonic}
							onChange={setMnemonic}
							onValidityChange={setIsMnemonicValid}
						/>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Button
						isDisabled={isButtonDisabled}
						text={$t('button_next')}
						onPress={handleButtonPress}
					/>
				</Spacer>
				<PasscodeView {...passcode.props} />
			</Screen.Bottom>
		</Screen>
	);
};
