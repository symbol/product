import { constants } from 'wallet-common-core';
import { useDataManager, useWalletControllers } from '@/app/hooks';
import { controllers, bridges } from '@/app/lib/controller';
import { useEffect } from 'react';

export const useBridgeAccounts = (onError) => {
    const walletControllers = useWalletControllers(controllers.additional);
    const accounts = walletControllers.map(controller => {
        const isActivated = controller.currentAccount !== null;
        const isLoading = controller.hasAccounts ? !controller.isWalletReady : false;

        return {
            controller,
            chainName: controller.chainName,
            isActivated,
            account: controller.currentAccount,
            sourceTokens: controller.modules.bridge.tokens,
            isLoading
        };
    });

    const bridgeTokens = accounts
        .filter(item => item.isActivated && item.sourceTokens)
        .flatMap(item => {
            const tokens = Array.isArray(item.sourceTokens) ? item.sourceTokens : [item.sourceTokens];
            return tokens.map(token => ({ chainName: item.chainName, token }));
        });

    const fetchBalances = async () => {
        await Promise.all(
            walletControllers
                .filter(controller => controller.currentAccount && controller.isWalletReady)
                .map(controller => controller.fetchAccountInfo())
        );
    };

    const fetchBridgeConfigs = async () => {
        await Promise.all(
            bridges
                .filter(bridge =>
                    bridge.nativeWalletController.hasAccounts &&
                    bridge.wrappedWalletController.hasAccounts &&
                    bridge.nativeWalletController.isWalletReady &&
                    bridge.wrappedWalletController.isWalletReady
                )
                .map(bridge => bridge.load())
        );
    };

    const [load, isLoading] = useDataManager(async () => {
        await fetchBalances();
        await fetchBridgeConfigs();
    }, null, onError, { defaultLoadingState: true });

    useEffect(() => {
        load();
    }, []);

    // Re-run load when any bridge wallet connects
    useEffect(() => {
        const unsubscribers = walletControllers.map(controller => {
            const onConnected = () => load();
            controller.on(constants.ControllerEventName.NETWORK_CONNECTED, onConnected);
            return () => controller.removeListener(constants.ControllerEventName.NETWORK_CONNECTED, onConnected);
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [walletControllers, load]);

    return { accounts, bridgeTokens, bridges, load, isLoading };
}
