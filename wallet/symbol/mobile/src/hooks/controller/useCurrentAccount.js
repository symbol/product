import walletController from '@/app/lib/controller/MobileWalletController';
import { constants } from 'wallet-common-core';
import { useEffect, useState } from 'react';

export const useCurrentAccount = () => {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        walletController.on(constants.ControllerEventName.ACCOUNT_CHANGE, handleStateChange);

        return () => {
            walletController.removeListener(constants.ControllerEventName.ACCOUNT_CHANGE, handleStateChange);
        };
    }, []);

    return walletController.currentAccount;
};
