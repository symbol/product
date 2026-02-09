import { Passcode, PasscodeView } from '@/app/components/features/Passcode/Passcode';
import { PASSCODE_MAX_FAILED_ATTEMPTS, PasscodeMode } from '@/app/constants';
import { passcodeManager } from '@/app/lib/passcode';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization } from '__tests__/mock-helpers';
import { act, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/app/lib/passcode', () => ({
	passcodeManager: {
		isPasscodeSet: jest.fn(),
		verify: jest.fn(),
		create: jest.fn(),
		getMaxAttempts: jest.fn().mockReturnValue(10)
	}
}));

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		vibrate: jest.fn(),
		getOS: jest.fn().mockReturnValue('android')
	}
}));

const TEST_PASSCODE = '1234';
const INCORRECT_PASSCODE = '0000';

const SCREEN_TEXT = {
	textCreateEnterTitle: 's_passcode_createEnter_title',
	textCreateConfirmTitle: 's_passcode_createConfirm_title',
	textVerifyTitle: 's_passcode_verify_title',
	textCreateEnterDescription: 's_passcode_createEnter_description',
	textCreateConfirmDescription: 's_passcode_createConfirm_description',
	textErrorIncorrect: 's_passcode_error_incorrect',
	textErrorMismatch: 's_passcode_error_mismatch',
	textErrorMaxAttempts: 's_passcode_error_maxAttempts',
	buttonCancel: 'button_cancel',
	buttonDelete: 'delete'
};

const PIN_PAD_BUTTONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const PasscodeVerifyResult = {
	VALID: { isValid: true, remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS, isLocked: false },
	INVALID: { isValid: false, remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 1, isLocked: false },
	LOCKED: { isValid: false, remainingAttempts: 0, isLocked: true }
};

const mockPasscodeManager = (overrides = {}) => {
	passcodeManager.isPasscodeSet.mockResolvedValue(overrides.isPasscodeSet ?? true);
	passcodeManager.verify.mockResolvedValue(overrides.verifyResult ?? PasscodeVerifyResult.VALID);
	passcodeManager.create.mockResolvedValue();
	passcodeManager.getMaxAttempts.mockReturnValue(PASSCODE_MAX_FAILED_ATTEMPTS);
};

const enterPasscode = (screenTester, passcode) => {
	passcode.split('').forEach(digit => {
		screenTester.presButtonByLabel(digit);
	});
};

const advanceTimersForPasscodeComplete = async () => {
	await act(async () => {
		jest.advanceTimersByTime(150);
	});
};

const advanceTimersPastError = async () => {
	await act(async () => {
		jest.advanceTimersByTime(1100);
	});
};

describe('components/features/Passcode', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		describe('pin pad', () => {
			it('renders all pin pad buttons', async () => {
				// Arrange:
				mockPasscodeManager();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: jest.fn()
				});
				await screenTester.waitForTimer();

				// Assert:
				screenTester.expectText(PIN_PAD_BUTTONS);
			});
		});

		describe('cancel button', () => {
			const runCancelButtonVisibilityTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					mockPasscodeManager();
					const props = {
						type: PasscodeMode.VERIFY,
						onSuccess: jest.fn(),
						...(config.hasOnCancel && { onCancel: jest.fn() })
					};

					// Act:
					const screenTester = new ScreenTester(Passcode, props);
					await screenTester.waitForTimer();

					// Assert:
					if (expected.isCancelVisible)
						screenTester.expectText([SCREEN_TEXT.buttonCancel]);
					else
						screenTester.notExpectText([SCREEN_TEXT.buttonCancel]);
				});
			};

			const cancelButtonVisibilityTests = [
				{
					description: 'renders cancel button when onCancel is provided',
					config: { hasOnCancel: true },
					expected: { isCancelVisible: true }
				},
				{
					description: 'does not render cancel button when onCancel is not provided',
					config: { hasOnCancel: false },
					expected: { isCancelVisible: false }
				}
			];

			cancelButtonVisibilityTests.forEach(test => {
				runCancelButtonVisibilityTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('verify mode', () => {
		describe('title and subtitle', () => {
			it('displays verify title', async () => {
				// Arrange:
				mockPasscodeManager();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: jest.fn()
				});
				await screenTester.waitForTimer();

				// Assert:
				screenTester.expectText([SCREEN_TEXT.textVerifyTitle]);
			});
		});

		describe('auto-success when no passcode set', () => {
			it('calls onSuccess immediately when no passcode is set', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();

				// Assert:
				expect(onSuccessMock).toHaveBeenCalledTimes(1);
			});
		});

		describe('passcode verification', () => {
			it('calls onSuccess when correct passcode is entered', async () => {
				// Arrange:
				mockPasscodeManager({ verifyResult: PasscodeVerifyResult.VALID });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				expect(passcodeManager.verify).toHaveBeenCalledWith(TEST_PASSCODE);
				expect(onSuccessMock).toHaveBeenCalledTimes(1);
			});

			it('shows error and vibrates when incorrect passcode is entered', async () => {
				// Arrange:
				mockPasscodeManager({ verifyResult: PasscodeVerifyResult.INVALID });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, INCORRECT_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				expect(passcodeManager.verify).toHaveBeenCalledWith(INCORRECT_PASSCODE);
				expect(onSuccessMock).not.toHaveBeenCalled();
				expect(PlatformUtils.vibrate).toHaveBeenCalled();
				screenTester.expectText([SCREEN_TEXT.textErrorIncorrect]);
			});

			it('shows max attempts error when account is locked', async () => {
				// Arrange:
				mockPasscodeManager({ verifyResult: PasscodeVerifyResult.LOCKED });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.VERIFY,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, INCORRECT_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				expect(onSuccessMock).not.toHaveBeenCalled();
				screenTester.expectText([SCREEN_TEXT.textErrorMaxAttempts]);
			});
		});
	});

	describe('create mode', () => {
		describe('enter step', () => {
			it('displays create enter title and description', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.CREATE,
					onSuccess: jest.fn()
				});
				await screenTester.waitForTimer();

				// Assert:
				screenTester.expectText([
					SCREEN_TEXT.textCreateEnterTitle,
					SCREEN_TEXT.textCreateEnterDescription
				]);
			});

			it('proceeds to confirm step after entering passcode', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.CREATE,
					onSuccess: jest.fn()
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				screenTester.expectText([
					SCREEN_TEXT.textCreateConfirmTitle,
					SCREEN_TEXT.textCreateConfirmDescription
				]);
			});
		});

		describe('confirm step', () => {
			it('calls onSuccess and creates passcode when confirmation matches', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.CREATE,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				expect(passcodeManager.create).toHaveBeenCalledWith(TEST_PASSCODE);
				expect(onSuccessMock).toHaveBeenCalledTimes(1);
			});

			it('shows mismatch error and returns to enter step when confirmation does not match', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });
				const onSuccessMock = jest.fn();

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.CREATE,
					onSuccess: onSuccessMock
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();
				enterPasscode(screenTester, INCORRECT_PASSCODE);
				await advanceTimersForPasscodeComplete();

				// Assert:
				expect(passcodeManager.create).not.toHaveBeenCalled();
				expect(onSuccessMock).not.toHaveBeenCalled();
				expect(PlatformUtils.vibrate).toHaveBeenCalled();
				screenTester.expectText([SCREEN_TEXT.textErrorMismatch]);
			});

			it('returns to enter step after mismatch error clears', async () => {
				// Arrange:
				mockPasscodeManager({ isPasscodeSet: false });

				// Act:
				const screenTester = new ScreenTester(Passcode, {
					type: PasscodeMode.CREATE,
					onSuccess: jest.fn()
				});
				await screenTester.waitForTimer();
				enterPasscode(screenTester, TEST_PASSCODE);
				await advanceTimersForPasscodeComplete();
				enterPasscode(screenTester, INCORRECT_PASSCODE);
				await advanceTimersForPasscodeComplete();
				await advanceTimersPastError();

				// Assert:
				screenTester.expectText([
					SCREEN_TEXT.textCreateEnterTitle,
					SCREEN_TEXT.textCreateEnterDescription
				]);
			});
		});
	});

	describe('pin pad interaction', () => {
		it('allows entering digits via pin pad', async () => {
			// Arrange:
			mockPasscodeManager();
			const onSuccessMock = jest.fn();

			// Act:
			const screenTester = new ScreenTester(Passcode, {
				type: PasscodeMode.VERIFY,
				onSuccess: onSuccessMock
			});
			await screenTester.waitForTimer();
			screenTester.presButtonByLabel('1');
			screenTester.presButtonByLabel('2');
			screenTester.presButtonByLabel('3');
			screenTester.presButtonByLabel('4');
			await advanceTimersForPasscodeComplete();

			// Assert:
			expect(passcodeManager.verify).toHaveBeenCalledWith('1234');
		});

		it('allows deleting digits via backspace', async () => {
			// Arrange:
			mockPasscodeManager({ verifyResult: PasscodeVerifyResult.VALID });
			const onSuccessMock = jest.fn();

			// Act:
			const screenTester = new ScreenTester(Passcode, {
				type: PasscodeMode.VERIFY,
				onSuccess: onSuccessMock
			});
			await screenTester.waitForTimer();
			screenTester.presButtonByLabel('1');
			screenTester.presButtonByLabel('2');
			screenTester.presButtonByLabel('3');
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonDelete);
			screenTester.presButtonByLabel('5');
			screenTester.presButtonByLabel('6');
			await advanceTimersForPasscodeComplete();

			// Assert:
			expect(passcodeManager.verify).toHaveBeenCalledWith('1256');
		});
	});

	describe('cancel action', () => {
		it('calls onCancel when cancel button is pressed', async () => {
			// Arrange:
			mockPasscodeManager();
			const onCancelMock = jest.fn();

			// Act:
			const screenTester = new ScreenTester(Passcode, {
				type: PasscodeMode.VERIFY,
				onSuccess: jest.fn(),
				onCancel: onCancelMock
			});
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.buttonCancel);

			// Assert:
			expect(onCancelMock).toHaveBeenCalledTimes(1);
		});
	});
});

describe('components/features/PasscodeView', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('visibility', () => {
		const runVisibilityTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockPasscodeManager();
				const props = {
					isVisible: config.isVisible,
					type: PasscodeMode.VERIFY,
					onSuccess: jest.fn()
				};

				// Act:
				const { queryByText } = render(<PasscodeView {...props} />);
				await act(async () => {
					jest.advanceTimersByTime(100);
				});

				// Assert:
				if (expected.isRendered)
					expect(queryByText(SCREEN_TEXT.textVerifyTitle)).toBeTruthy();
				else
					expect(queryByText(SCREEN_TEXT.textVerifyTitle)).toBeNull();
			});
		};

		const visibilityTests = [
			{
				description: 'renders modal content when isVisible is true',
				config: { isVisible: true },
				expected: { isRendered: true }
			},
			{
				description: 'does not render modal content when isVisible is false',
				config: { isVisible: false },
				expected: { isRendered: false }
			}
		];

		visibilityTests.forEach(test => {
			runVisibilityTest(test.description, test.config, test.expected);
		});
	});
});
