import { PasscodeStep } from '../constants';
import { PasscodeMode } from '@/app/constants';
import { passcodeManager } from '@/app/lib/passcode';
import { $t } from '@/app/localization';

/**
 * Get the title text based on passcode mode and step.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {boolean} isConfirmStep - Whether in confirm step.
 * @returns {string} - The title text.
 */
export const getPasscodeTitle = (mode, step) => {
	if (mode === PasscodeMode.CREATE && step === PasscodeStep.ENTER)
		return $t('s_passcode_createEnter_title');

	if (mode === PasscodeMode.CREATE && step === PasscodeStep.CONFIRM)
		return $t('s_passcode_createConfirm_title');
    
	return $t('s_passcode_verify_title');
};

/**
 * Get the subtitle text based on passcode state.
 * @param {object} params - The parameters.
 * @param {string} params.errorMessage - Current error message.
 * @param {boolean} params.isCreateMode - Whether in create mode.
 * @param {boolean} params.isConfirmStep - Whether in confirm step.
 * @param {number|null} params.remainingAttempts - Remaining verification attempts.
 * @returns {string} - The subtitle text.
 */
export const getPasscodeSubtitle = ({ errorMessage, mode, step, remainingAttempts }) => {
	if (errorMessage) 
		return errorMessage;
	
	if (mode === PasscodeMode.CREATE && step === PasscodeStep.ENTER)
		return $t('s_passcode_createEnter_description');

	if (mode === PasscodeMode.CREATE && step === PasscodeStep.CONFIRM) 
		return $t('s_passcode_createConfirm_description');
    
	if (remainingAttempts && remainingAttempts < passcodeManager.getMaxAttempts())
		return $t('s_passcode_verify_attempt_description', { attempts: remainingAttempts });
	
	return '';
};

/**
 * Reset passcode state to initial values.
 * @param {object} setters - State setter functions.
 * @param {function(string): void} setters.setPasscode - Set passcode state.
 * @param {function(string): void} setters.setConfirmPasscode - Set confirm passcode state.
 * @param {function(*): void} setters.setStep - Set step state.
 */
export const resetPasscodeState = ({ setPasscode, setConfirmPasscode, setStep }) => {
	setPasscode('');
	setConfirmPasscode('');
	setStep(PasscodeStep.ENTER);
};
