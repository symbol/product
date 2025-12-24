import walletController from '@/app/lib/controller/MobileWalletController';
import { constants } from 'wallet-common-core';
import { useEffect, useState } from 'react';

export const useNetworkStatus = () => {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        walletController.on(constants.ControllerEventName.NETWORK_STATUS_CHANGE, handleStateChange);

        return () => {
            walletController.removeListener(constants.ControllerEventName.NETWORK_STATUS_CHANGE, handleStateChange);
        };
    }, []);

    return walletController.networkStatus;
};
