import { PasscodeMode } from '@/app/constants';
import { useCallback, useState } from 'react';

/**
 * Hook to launch the PasscodeView component.
 *
 * @param {object} params - The parameters.
 * @param {function} params.onSuccess - The success callback.
 * @param {function} [params.onCancel] - The cancel callback.
 * @param {'create' | 'verify'} [type] - The type of passcode action.
 * @returns {object} The passcode controller with show function and PasscodeView props.
 */
export const usePasscode = ({ onSuccess, onCancel }, type = PasscodeMode.VERIFY) => {
	const [isVisible, setIsVisible] = useState(false);

	const handleSuccess = useCallback(() => {
		setIsVisible(false);
		onSuccess?.();
	}, [onSuccess]);

	const handleCancel = useCallback(() => {
		setIsVisible(false);
		onCancel?.();
	}, [onCancel]);

	const show = useCallback(() => {
		setIsVisible(true);
	}, []);

	const hide = useCallback(() => {
		setIsVisible(false);
	}, []);

	const props = {
		onSuccess: handleSuccess,
		onCancel: handleCancel,
		type,
		isVisible
	};

	return { show, hide, props };
};
