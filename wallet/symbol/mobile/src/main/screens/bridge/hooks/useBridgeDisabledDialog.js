import { Router } from '@/app/router/Router';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { useEffect, useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */

/**
 * Determines if the bridge disabled dialog should be shown.
 * @param {BridgePairsStatusType} pairsStatus - Current pairs status.
 * @returns {boolean} True if dialog should be shown.
 */
const shouldShowDisabledDialog = pairsStatus => {
	return pairsStatus === BridgePairsStatus.DISABLED;
};

/**
 * Return type for useBridgeDisabledDialog hook.
 * @typedef {object} UseBridgeDisabledDialogReturnType
 * @property {boolean} isVisible - Whether the dialog is visible.
 * @property {() => void} onClose - Handler for the close action (navigates back).
 * @property {() => void} onScreenFocus - Handler for screen focus (rechecks visibility).
 */

/**
 * React hook for managing the "bridge disabled" dialog visibility and actions.
 * Shows the dialog when every bridge is turned off by its operator. There is nothing the user
 * can do about it, so the only action is to leave the screen.
 * @param {object} params - Hook parameters.
 * @param {BridgePairsStatusType} params.pairsStatus - Current pairs status.
 * @returns {UseBridgeDisabledDialogReturnType}
 */
export const useBridgeDisabledDialog = ({ pairsStatus }) => {
	const [isVisible, setIsVisible] = useState(shouldShowDisabledDialog(pairsStatus));

	const onClose = () => {
		setIsVisible(false);
		Router.goBack();
	};
	const onScreenFocus = () => {
		setIsVisible(shouldShowDisabledDialog(pairsStatus));
	};

	useEffect(() => {
		setIsVisible(shouldShowDisabledDialog(pairsStatus));
	}, [pairsStatus]);

	return {
		isVisible,
		onClose,
		onScreenFocus
	};
};
