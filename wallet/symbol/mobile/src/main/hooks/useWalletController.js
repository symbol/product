import { walletControllers } from '@/app/lib/controller';
import { useEffect, useMemo, useState } from 'react';
import { constants } from 'wallet-common-core';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Wallet').AdditionalWalletController} AdditionalWalletController */

/**
 * React hook to access the wallet controller.
 * It listens for state changes and updates the component when the state changes.
 * @returns {MainWalletController | AdditionalWalletController} The wallet controller instance.
 */
export const useWalletController = chainName => {
	const walletController = useMemo(() => {
		if (!chainName || walletControllers.main.chainName === chainName)
			return walletControllers.main;

		return walletControllers.additional.find(c => c.chainName === chainName);
	}, [chainName]);
	const [, setVersion] = useState(0);

	useEffect(() => {
		const handleStateChange = () => {
			setVersion(prevVersion => prevVersion + 1);
		};
		walletController.on(constants.ControllerEventName.STATE_CHANGE, handleStateChange);

		return () => {
			walletController.removeListener(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
		};
	}, [walletController]);

	return walletController;
};
