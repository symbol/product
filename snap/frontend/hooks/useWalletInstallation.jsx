import { getSnap } from '../utils/snap';
import { useEffect, useState } from 'react';

const useWalletInstallation = () => {
	const [isMetamaskInstalled, setIsMetamaskInstalled] = useState(false);
	const [isSnapInstalled, setIsSnapInstalled] = useState(false);

	useEffect(() => {
		const checkInstallationStatus = async () => {
			if (window.ethereum && window.ethereum.isMetaMask) {
				setIsMetamaskInstalled(true);

				const installedSnap = await getSnap();

				if (installedSnap && installedSnap.enabled)
					setIsSnapInstalled(true);
				else
					throw new Error('Please connect snap and enable it in MetaMask');
			}
		};

		checkInstallationStatus();
	}, [isSnapInstalled]);

	return { isMetamaskInstalled, isSnapInstalled };
};

export default useWalletInstallation;
