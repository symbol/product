import { usePasscodeShake } from './usePasscodeShake';
import {
	ERROR_DISPLAY_DURATION_MS,
	PASSCODE_COMPLETE_DELAY_MS,
	PasscodeStep
} from '../constants';
import { usePasscodeInput } from '@/app/components/features/Passcode/hooks/usePasscodeInput';
import { PASSCODE_PIN_LENGTH, PasscodeMode } from '@/app/constants';
import { passcodeManager } from '@/app/lib/passcode';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { useEffect, useState } from 'react';

/**
 * Hook for managing passcode input logic.
 * @param {object} params - Hook parameters.
 * @param {string} params.mode - Passcode mode (create or verify).
 * @param {function} params.onSuccess - Success callback.
 * @returns {object} - Passcode input state and handlers.
 */
export const usePasscodeManager = ({ mode, onSuccess }) => {
	// State
	const [isLoading, setIsLoading] = useState(true);
	const [step, setStep] = useState(PasscodeStep.ENTER);
	const [isError, setIsError] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [remainingAttempts, setRemainingAttempts] = useState(null);
	const [isTooManyAttempts, setIsTooManyAttempts] = useState(false);
	const passcodeInput = usePasscodeInput({
		length: PASSCODE_PIN_LENGTH,
		onComplete: value => handleCompleteInput(value)
	});
	const passcodeConfirmInput = usePasscodeInput({
		length: PASSCODE_PIN_LENGTH,
		onComplete: value => handleCompleteInput(value)
	});

	// Animation
	const { shakeAnimation, triggerShake } = usePasscodeShake();

	// Computed
	const isCreateMode = mode === PasscodeMode.CREATE;
	const isConfirmStep = step === PasscodeStep.CONFIRM;
	const currentPasscodeInput = isConfirmStep
		? passcodeConfirmInput
		: passcodeInput;
	const { inputKey, backspace, value: currentInputValue } = currentPasscodeInput;

	// Error handling
	const showError = (message = '') => {
		setIsError(true);
		setErrorMessage(message);
		triggerShake();
		PlatformUtils.vibrate();

		setTimeout(() => {
			setIsError(false);
			setErrorMessage('');
		}, ERROR_DISPLAY_DURATION_MS);
	};

	// Handlers
	const handleVerifyPasscode = async inputPasscode => {
		const result = await passcodeManager.verify(inputPasscode);

		if (result.isValid) {
			onSuccess();
			return;
		}

		setIsTooManyAttempts(result.isLocked);
		setRemainingAttempts(result.remainingAttempts);

		let errorMessage;
		if (result.isLocked)
			errorMessage = $t('s_passcode_error_maxAttempts');
		else
			errorMessage = $t('s_passcode_error_incorrect');

		showError(errorMessage);
		passcodeInput.clear();
	};

	const handleCreatePasscode = async inputPasscode => {
		if (step === PasscodeStep.ENTER) {
			setStep(PasscodeStep.CONFIRM);
			return;
		}

		if (inputPasscode === passcodeInput.value) {
			await passcodeManager.create(inputPasscode);
			onSuccess();
			return;
		}

		showError($t('s_passcode_error_mismatch'));
		setStep(PasscodeStep.ENTER);
		passcodeInput.clear();
		passcodeConfirmInput.clear();
	};

	const handleCompleteInput = value => {
		setTimeout(() => {
			if (isCreateMode)
				handleCreatePasscode(value);
			else
				handleVerifyPasscode(value);
		}, PASSCODE_COMPLETE_DELAY_MS);
	};

	// Initialize
	useEffect(() => {
		const initialize = async () => {
			const isPasscodeEnabled = await passcodeManager.isPasscodeSet();

			if (!isPasscodeEnabled && mode === PasscodeMode.VERIFY)
				onSuccess();

			setIsLoading(false);
		};

		initialize();
	}, [mode, onSuccess]);

	return {
		isLoading,
		isError,
		errorMessage,
		remainingAttempts,
		isTooManyAttempts,
		currentInputValue,
		step,
		shakeAnimation,
		inputKey,
		backspace
	};
};
