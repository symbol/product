import controller from '@/app/lib/controller/MobileWalletController';
import { constants } from 'wallet-common-core';
import { useEffect, useState } from 'react';

/**
 * Hook to access the wallet controller.
 * It listens for state changes and updates the component when the state changes.
 * @returns {typeof controller} The wallet controller instance.
 */
export const useWalletControllers = (walletControllers) => {
    const [c, setVersion] = useState(0);

    //console.log('Current version:', c);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        walletControllers.forEach(controller => {
            controller.on(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
        });

        return () => {
            walletControllers.forEach(controller => {
                controller.removeListener(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
            });
        };
    }, []);

    return walletControllers;
};
