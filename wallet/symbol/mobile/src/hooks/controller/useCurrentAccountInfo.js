import walletController from '@/app/lib/controller/MobileWalletController';
import { constants } from 'wallet-common-core';
import { useEffect, useState } from 'react';

const defaultAccountInfo = {
	fetchedAt: 0,
	isMultisig: false, // wether account is multisig
	cosignatories: [], // if an account is multisig, contains the list of its cosigners
	multisigAddresses: [], // list of multisig addresses which the account is cosignatory of
	balance: 0, // currency mosaic amount
	mosaics: [], // account owned mosaics
	namespaces: [], // account owned namespaces
	importance: 0,
	linkedKeys: {
		linkedPublicKey: null,
		nodePublicKey: null,
		vrfPublicKey: null
	}
};

export const useCurrentAccountInfo = () => {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const handleStateChange = () => {
            setVersion(prevVersion => prevVersion + 1);
        };
        walletController.on(constants.ControllerEventName.ACCOUNT_INFO_CHANGE, handleStateChange);

        return () => {
            walletController.removeListener(constants.ControllerEventName.ACCOUNT_INFO_CHANGE, handleStateChange);
        };
    }, []);

    return walletController.currentAccountInfo || defaultAccountInfo;
};
