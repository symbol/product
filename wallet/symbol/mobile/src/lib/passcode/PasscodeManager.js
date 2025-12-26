import { deleteUserPinCode, hasUserSetPinCode, resetPinCodeInternalStates } from '@haskkor/react-native-pincode';

export class PasscodeManager {
	constructor() {}

	isPasscodeSet = async () => {
		return hasUserSetPinCode();
	};

	clear = async () => {
		await deleteUserPinCode();
		await resetPinCodeInternalStates();
	};
}
