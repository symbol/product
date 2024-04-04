import { actionTypes, useWalletContext } from '../context';
import symbolSnap from '../utils/snap';
import { useEffect } from 'react';

const useWalletInstallation = () => {
	const { walletState, dispatch } = useWalletContext();
	const { isMetamaskInstalled, isSnapInstalled } = walletState;

	useEffect(() => {
		const checkInstallationStatus = async () => {
			if (window.ethereum && window.ethereum.isMetaMask) {
				dispatch({ type: actionTypes.SET_METAMASK_INSTALLED, payload: true });

				const installedSnap = await symbolSnap().getSnap();

				if (installedSnap && installedSnap.enabled)
					dispatch({ type: actionTypes.SET_SNAP_INSTALLED, payload: true });
			}
		};

		checkInstallationStatus();
	}, [isSnapInstalled, dispatch]);

	return { isMetamaskInstalled, isSnapInstalled };
};

export default useWalletInstallation;
