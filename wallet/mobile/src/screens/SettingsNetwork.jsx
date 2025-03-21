import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Dropdown, FormItem, Screen, StyledText, TableView, Widget } from '@/app/components';
import { $t } from '@/app/localization';
import { colors } from '@/app/styles';
import { handleError } from '@/app/utils';
import { useDataManager, useProp } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import { NetworkIdentifier } from '@/app/constants';
import Animated, { FadeIn } from 'react-native-reanimated';

export const SettingsNetwork = observer(function SettingsNetwork() {
    const { networkProperties, nodeUrls, networkIdentifier, selectedNodeUrl, isNetworkConnectionReady } = WalletController;
    const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useProp(networkIdentifier, networkIdentifier);
    const isConnectingToNode = !isNetworkConnectionReady;

    const getTableValueNullable = (value) => value === null ? '-' : value;
    const networkInfoTable = {
        network: getTableValueNullable(networkProperties.networkIdentifier),
        nodeUrl: getTableValueNullable(networkProperties.nodeUrl),
        chainHeight: getTableValueNullable(networkProperties.chainHeight),
        minFeeMultiplier: getTableValueNullable(networkProperties.transactionFees.minFeeMultiplier),
    };
    const tableStyle = isConnectingToNode ? { opacity: 0.25 } : null;

    const networkIdentifierOptions = [
        {
            label: $t('s_settings_networkType_mainnet'),
            value: NetworkIdentifier.MAIN_NET,
        },
        {
            label: $t('s_settings_networkType_testnet'),
            value: NetworkIdentifier.TEST_NET,
        },
    ];
    const nodeOptions = [
        {
            label: $t('s_settings_node_automatically'),
            value: null,
        },
        ...nodeUrls[selectedNetworkIdentifier].map((nodeUrl) => ({
            label: nodeUrl,
            value: nodeUrl,
        })),
    ]

    const [saveChanges, isSavingChanges] = useDataManager(
        async (networkIdentifier, nodeUrl) => {
            await WalletController.selectNetwork(networkIdentifier, nodeUrl);
            WalletController.runConnectionJob();
        },
        null,
        handleError
    );
    const selectNetwork = async (networkIdentifier) => {
        setSelectedNetworkIdentifier(networkIdentifier);
        saveChanges(networkIdentifier, null);
    };
    const selectNode = async (nodeUrl) => {
        saveChanges(networkIdentifier, nodeUrl);
    };

    return (
        <Screen isLoading={isSavingChanges}>
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{$t('s_settings_network_select_title')}</StyledText>
                    <Dropdown
                        value={selectedNetworkIdentifier}
                        list={networkIdentifierOptions}
                        title={$t('s_settings_networkType_modal_title')}
                        onChange={selectNetwork}
                    />
                </FormItem>
                <FormItem>
                    <Dropdown
                        value={selectedNodeUrl}
                        list={nodeOptions}
                        title={$t('s_settings_node_select_title')}
                        onChange={selectNode}
                    />
                </FormItem>
                <FormItem>
                    <StyledText type="title">{$t('s_settings_node_info_title')}</StyledText>
                    <Widget>
                        <FormItem>
                            <Animated.View entering={FadeIn} key={networkInfoTable.nodeUrl}>
                                <TableView data={networkInfoTable} style={tableStyle} />
                            </Animated.View>
                            {isConnectingToNode && (
                                <View style={styles.tableLoadingContainer}>
                                    <ActivityIndicator color={colors.primary} size="large" />
                                </View>
                            )}
                        </FormItem>
                    </Widget>
                </FormItem>
            </ScrollView>
        </Screen>
    );
});

const styles = StyleSheet.create({
    tableLoadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
