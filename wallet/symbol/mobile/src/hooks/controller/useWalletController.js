import { controllers } from '@/app/lib/controller';
import { constants } from 'wallet-common-core';
import { useEffect, useMemo, useState } from 'react';

/**
 * Hook to access the wallet controller.
 * It listens for state changes and updates the component when the state changes.
 * @returns {typeof controller} The wallet controller instance.
 */
export const useWalletController = (chainName) => {
    const controller = useMemo(() => {
        if (!chainName || controllers.main.chainName === chainName)
            return controllers.main;

        return controllers.additional.find(c => c.chainName === chainName);
    }, [chainName]);
    const [version, setVersion] = useState(0);
    
    if (false) console.log('useWalletController', version);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        controller.on(constants.ControllerEventName.STATE_CHANGE, handleStateChange);

        return () => {
            controller.removeListener(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
        };
    }, []);

    return controller;
};
