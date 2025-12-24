import walletController from '@/app/lib/controller/MobileWalletController';
import { constants } from 'wallet-common-core';
import { useEffect, useState } from 'react';

export const useNetworkProperties = () => {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        walletController.on(constants.ControllerEventName.NETWORK_PROPERTIES_CHANGE, handleStateChange);

        return () => {
            walletController.removeListener(constants.ControllerEventName.NETWORK_PROPERTIES_CHANGE, handleStateChange);
        };
    }, []);

    return walletController.networkProperties;
};
