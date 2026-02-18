import { useState } from 'react';

const EnterType = {
	CREATE: 'create',
	VERIFY: 'verify'
};

/**
 * Hook to launch the PasscodeView component.
 *
 * @param {object} params - The parameters.
 * @param {function} params.onSuccess The success callback.
 * @param {function} [params.onCancel] The cancel callback.
 * @param {'create' | 'verify'} [type] The type of passcode action.
 * @returns {object} The passcode controller with show function and PasscodeView props.
 */
export const usePasscode = ({ onSuccess, onCancel }, type = EnterType.VERIFY) => {
	const [isVisible, setIsVisible] = useState(false);
	const props = {
		onSuccess: () => {
			setIsVisible(false);
			onSuccess();
		},
		onCancel: () => {
			setIsVisible(false);
			onCancel?.();
		},
		type,
		isVisible
	};
	const show = () => {
		setIsVisible(true);
	};

	return { show, props };
};
