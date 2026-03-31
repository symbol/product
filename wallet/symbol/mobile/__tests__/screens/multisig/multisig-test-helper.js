export const ACTION_TYPE = {
	ADD_COSIGNATORY: 'add',
	REMOVE_COSIGNATORY: 'remove',
	INCREMENT_APPROVAL: 'increment-approval',
	DECREMENT_APPROVAL: 'decrement-approval',
	INCREMENT_REMOVAL: 'increment-removal',
	DECREMENT_REMOVAL: 'decrement-removal'
};

/**
 * Shared test helpers for multisig screen tests.
 * Provides reusable interactions that appear identically across CreateMultisigAccount
 * and ModifyMultisigAccount test files.
 */

/**
 * Opens the add-cosignatory dialog, types the address, and confirms.
 *
 * @param {import('__tests__/ScreenTester').ScreenTester} screenTester
 * @param {Object} screenText - The SCREEN_TEXT constant from the calling test file.
 * @param {string} address - Cosignatory address to add.
 */
export const addCosignatory = async (screenTester, screenText, address) => {
	screenTester.pressButton(screenText.buttonAdd);
	screenTester.inputText(screenText.labelInputAddress, address);
	screenTester.pressButton(screenText.buttonConfirm);
	await screenTester.waitForTimer();
};

/**
 * Dispatches a single approval/removal counter action (increment or decrement).
 *
 * @param {import('__tests__/ScreenTester').ScreenTester} screenTester
 * @param {Object} screenText - The SCREEN_TEXT constant from the calling test file.
 * @param {{ type: 'increment-approval' | 'decrement-approval' | 'increment-removal' | 'decrement-removal' }} action
 */
export const applyCounterAction = (screenTester, screenText, action) => {
	if (action.type === ACTION_TYPE.INCREMENT_APPROVAL)
		screenTester.presButtonByLabel(screenText.labelButtonPlus, 0);
	else if (action.type === ACTION_TYPE.DECREMENT_APPROVAL)
		screenTester.presButtonByLabel(screenText.labelButtonMinus, 0);
	else if (action.type === ACTION_TYPE.INCREMENT_REMOVAL)
		screenTester.presButtonByLabel(screenText.labelButtonPlus, 1);
	else if (action.type === ACTION_TYPE.DECREMENT_REMOVAL)
		screenTester.presButtonByLabel(screenText.labelButtonMinus, 1);
};
