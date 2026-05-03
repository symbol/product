import { Router } from '@/app/router/Router';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { useEffect, useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */

/**
 * Determines if the no pairs dialog should be shown.
 * @param {BridgePairsStatusType} pairsStatus - Current pairs status.
 * @returns {boolean} True if dialog should be shown.
 */
const shouldShowNoPairsDialog = pairsStatus => {
	return pairsStatus === BridgePairsStatus.NO_PAIRS;
};

/**
 * Return type for useBridgeNoPairsDialog hook.
 * @typedef {object} UseBridgeNoPairsDialogReturnType
 * @property {boolean} isVisible - Whether the dialog is visible.
 * @property {() => void} onSuccess - Handler for success action (navigates to account list).
 * @property {() => void} onCancel - Handler for cancel action (navigates back).
 * @property {() => void} onScreenFocus - Handler for screen focus (rechecks visibility).
 */

/**
 * React hook for managing the "no pairs available" dialog visibility and actions.
 * Shows dialog when no bridge pairs are available and handles navigation.
 * @param {object} params - Hook parameters.
 * @param {BridgePairsStatusType} params.pairsStatus - Current pairs status.
 * @returns {UseBridgeNoPairsDialogReturnType}
 */
export const useBridgeNoPairsDialog = ({ pairsStatus }) => {
	const [isVisible, setIsVisible] = useState(shouldShowNoPairsDialog(pairsStatus));

	const onSuccess = () => {
		setIsVisible(false);
		Router.goToBridgeAccountList();
	};
	const onCancel = () => {
		setIsVisible(false);
		Router.goBack();
	};
	const onScreenFocus = () => {
		setIsVisible(shouldShowNoPairsDialog(pairsStatus));
	};

	useEffect(() => {
		setIsVisible(shouldShowNoPairsDialog(pairsStatus));
	}, [pairsStatus]);

	return {
		isVisible,
		onSuccess,
		onCancel,
		onScreenFocus
	};
};
