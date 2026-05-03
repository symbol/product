import { walletControllers } from '@/app/lib/controller';
import { useEffect, useMemo, useState } from 'react';
import { WalletController, constants } from 'wallet-common-core';

/**
 * React hook to access the wallet controller.
 * It listens for state changes and updates the component when the state changes.
 * @returns {Array<typeof walletControllers.main | WalletController>} The wallet controller instance.
 */
export const useReactiveWalletControllers = walletControllers => {
	const [, setVersion] = useState(0);

	const memoizedControllers = useMemo(() => walletControllers, [...walletControllers]);

	useEffect(() => {
		const handleStateChange = () => {
			setVersion(prevVersion => prevVersion + 1);
		};
		memoizedControllers.forEach(controller => {
			controller.on(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
		});

		return () => {
			memoizedControllers.forEach(controller => {
				controller.removeListener(constants.ControllerEventName.STATE_CHANGE, handleStateChange);
			});
		};
	}, [memoizedControllers]);

	return memoizedControllers;
};
