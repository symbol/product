export const SHAKE_OFFSET = 10;
export const SHAKE_DURATION_MS = 50;
export const ERROR_DISPLAY_DURATION_MS = 1000;
export const PASSCODE_COMPLETE_DELAY_MS = 100;

export const PasscodeStep = {
	ENTER: 'enter',
	CONFIRM: 'confirm'
};

export const PasscodeResultType = {
	CONFIRMATION_EXPECTED: 'confirmation_expected',
	CONFIRMATION_SUCCESS: 'confirmation_success',
	CONFIRMATION_MISMATCH: 'confirmation_mismatch',
	VERIFICATION_SUCCESS: 'verification_success',
	VERIFICATION_FAIL: 'verification_fail',
	VERIFICATION_ATTEMPTS_EXCEEDED: 'verification_attempts_exceeded'
};
