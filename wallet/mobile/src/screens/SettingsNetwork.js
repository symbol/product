import React from 'react';
import { StyleSheet } from 'react-native';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { Dropdown, FormItem, Screen, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { borders, colors, spacings } from '@/app/styles';
import { handleError } from '@/app/utils';
import { useDataManager, useProp } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import { NetworkIdentifier } from '@/app/constants';

export const SettingsNetwork = observer(function SettingsNetwork() {
    const { networkProperties, nodeUrls, networkIdentifier } = WalletController;
    const { nodeUrl } = networkProperties;
    const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useProp(networkIdentifier, networkIdentifier);
    const [selectedNodeUrl, setSelectedNodeUrl] = useProp(nodeUrl, nodeUrl);
    const networkIdentifiers = [
        {
            label: $t('s_settings_networkType_mainnet'),
            value: NetworkIdentifier.MAIN_NET,
        },
        {
            label: $t('s_settings_networkType_testnet'),
            value: NetworkIdentifier.TEST_NET,
        },
    ];
    const networkNodes = [null, ...nodeUrls[selectedNetworkIdentifier]];

    const getNodeTitle = (nodeUrl) => (nodeUrl === null ? $t('s_settings_node_automatically') : nodeUrl);
    const getNodeStyle = (nodeUrl) => (nodeUrl === selectedNodeUrl ? [styles.item, styles.itemSelected] : styles.item);
    const [saveChanges, isLoading] = useDataManager(
        async (networkIdentifier, nodeUrl) => {
            await WalletController.selectNetwork(networkIdentifier, nodeUrl);
            WalletController.runConnectionJob();
        },
        null,
        handleError
    );
    const selectNetwork = async (networkIdentifier) => {
        setSelectedNetworkIdentifier(networkIdentifier);
        setSelectedNodeUrl(null);
        saveChanges(networkIdentifier, null);
    };
    const selectNode = async (nodeUrl) => {
        setSelectedNodeUrl(nodeUrl);
        saveChanges(networkIdentifier, nodeUrl);
    };

    return (
        <Screen isLoading={isLoading}>
            <FormItem>
                <StyledText type="title">{$t('s_settings_network_select_title')}</StyledText>
                <Dropdown
                    value={selectedNetworkIdentifier}
                    list={networkIdentifiers}
                    title={$t('s_settings_networkType_modal_title')}
                    onChange={selectNetwork}
                />
            </FormItem>
            <FormItem clear="bottom" fill>
                <StyledText type="title">{$t('s_settings_node_select_title')}</StyledText>
                <FlatList
                    data={networkNodes}
                    keyExtractor={(item, index) => 'nl' + item + index}
                    renderItem={({ item }) => (
                        <FormItem type="list">
                            <TouchableOpacity style={getNodeStyle(item)} onPress={() => selectNode(item)}>
                                <StyledText type="body">{getNodeTitle(item)}</StyledText>
                            </TouchableOpacity>
                        </FormItem>
                    )}
                />
            </FormItem>
        </Screen>
    );
});

const styles = StyleSheet.create({
    item: {
        borderRadius: borders.borderRadius,
        backgroundColor: colors.bgCard,
        padding: spacings.padding,
    },
    itemSelected: {
        backgroundColor: colors.accentLightForm,
    },
});
