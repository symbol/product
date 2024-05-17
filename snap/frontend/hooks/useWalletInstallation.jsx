import { actionTypes, useWalletContext } from '../context';
import { useEffect } from 'react';

const useWalletInstallation = () => {
	const { walletState, dispatch, symbolSnap } = useWalletContext();
	const { isSnapInstalled } = walletState;

	useEffect(() => {
		const checkInstallationStatus = async () => {
			const installedSnap = await symbolSnap.getSnap();

			if (installedSnap && installedSnap.enabled)
				dispatch({ type: actionTypes.SET_SNAP_INSTALLED, payload: true });
		};

		checkInstallationStatus();
	}, [dispatch, symbolSnap]);

	return { isSnapInstalled };
};

export default useWalletInstallation;
