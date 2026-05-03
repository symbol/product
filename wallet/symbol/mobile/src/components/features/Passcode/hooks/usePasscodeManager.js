import { usePasscodeJumpAnimation } from './usePasscodeJumpAnimation';
import { usePasscodeShake } from './usePasscodeShake';
import {
	ERROR_DISPLAY_DURATION_MS,
	PASSCODE_COMPLETE_DELAY_MS,
	PasscodeStep
} from '../constants';
import { usePasscodeInput } from '@/app/components/features/Passcode/hooks/usePasscodeInput';
import { PASSCODE_PIN_LENGTH, PasscodeMode } from '@/app/constants';
import { useAsyncManager } from '@/app/hooks';
import { passcodeManager } from '@/app/lib/passcode';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { useEffect, useState } from 'react';

/**
 * React hook for managing passcode input logic.
 * @param {object} params - Hook parameters.
 * @param {string} params.mode - Passcode mode (create or verify).
 * @param {function(): void} params.onSuccess - Success callback.
 * @returns {object} - Passcode input state and handlers.
 */
export const usePasscodeManager = ({ mode, onSuccess }) => {
	// State
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
	const { dotAnimations, startJumpAnimation, stopJumpAnimation } = usePasscodeJumpAnimation();

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

	// Async managers
	const initManager = useAsyncManager({
		callback: async () => {
			const isPasscodeEnabled = await passcodeManager.isPasscodeSet();

			if (!isPasscodeEnabled && mode === PasscodeMode.VERIFY)
				onSuccess();
		},
		defaultLoadingState: true,
		shouldShowErrorPopup: false
	});

	const verifyManager = useAsyncManager({
		callback: async inputPasscode => {
			const result = await passcodeManager.verify(inputPasscode);

			if (result.isValid) {
				onSuccess();
				return result;
			}

			setIsTooManyAttempts(result.isLocked);
			setRemainingAttempts(result.remainingAttempts);

			let errorMessage;
			if (result.isLocked) {
				const remainingTimeMs = result.lockoutUntil - Date.now();
				const remainingMinutes = Math.ceil(remainingTimeMs / 60000);
				errorMessage = remainingMinutes > 1
					? $t('s_passcode_error_maxAttempts_time_minutes', { count: remainingMinutes })
					: $t('s_passcode_error_maxAttempts_time_minute');
			} else {
				errorMessage = $t('s_passcode_error_incorrect');
			}

			showError(errorMessage);
			passcodeInput.clear();

			return result;
		},
		shouldShowErrorPopup: false,
		onError: () => passcodeInput.clear()
	});

	const createManager = useAsyncManager({
		callback: async inputPasscode => {
			await passcodeManager.create(inputPasscode);
			onSuccess();
		},
		shouldShowErrorPopup: false,
		onError: () => {
			passcodeInput.clear();
			passcodeConfirmInput.clear();
			setStep(PasscodeStep.ENTER);
		}
	});

	// Derived validating state
	const isValidating = verifyManager.isLoading || createManager.isLoading;

	// Handle validation state changes
	useEffect(() => {
		if (isValidating) 
			startJumpAnimation();
		else 
			stopJumpAnimation();
	}, [isValidating, startJumpAnimation, stopJumpAnimation]);

	// Handlers
	const handleCreatePasscode = inputPasscode => {
		if (step === PasscodeStep.ENTER) {
			setStep(PasscodeStep.CONFIRM);
			return;
		}

		if (inputPasscode === passcodeInput.value) {
			createManager.call(inputPasscode);
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
				verifyManager.call(value);
		}, PASSCODE_COMPLETE_DELAY_MS);
	};

	// Initialize
	useEffect(() => { 
		initManager.call(); 
	}, []);

	return {
		isLoading: initManager.isLoading,
		isValidating,
		isError,
		errorMessage,
		remainingAttempts,
		isTooManyAttempts,
		currentInputValue,
		step,
		shakeAnimation,
		dotAnimations,
		inputKey,
		backspace
	};
};
