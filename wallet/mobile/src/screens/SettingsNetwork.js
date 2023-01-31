import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { Dropdown, Screen, FormItem, StyledText } from 'src/components';
import store, { connect } from 'src/store';
import { borders, colors, spacings } from 'src/styles';
import { handleError, useDataManager, useProp } from 'src/utils';

export const SettingsNetwork = connect(state => ({
    currentAccount: state.account.current,
    nodeUrl: state.network.selectedNodeUrl,
    networkIdentifier: state.network.networkIdentifier,
    nodeUrls: state.network.nodeUrls,
}))(function SettingsNetwork(props) {
    const { nodeUrl, networkIdentifier, nodeUrls } = props;
    const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useProp(networkIdentifier, networkIdentifier);
    const [selectedNodeUrl, setSelectedNodeUrl] = useProp(nodeUrl, nodeUrl);

    const networkIdentifiers = [{
        // notranslate
        label: 'Mainnet',
        value: 'mainnet'
    }, {
        // notranslate
        label: 'Testnet',
        value: 'testnet'
    }];

    const networkNodes = [null, ...nodeUrls[selectedNetworkIdentifier]];

    // notranslate
    const getNodeTitle = (nodeUrl) => nodeUrl === null ? 'Select Automatically' : nodeUrl;
    const getNodeStyle = (nodeUrl) => nodeUrl === selectedNodeUrl ? [styles.item, styles.itemSelected] : styles.item;

    const [saveChanges, isLoading] = useDataManager(async (networkIdentifier, nodeUrl) => {
        await store.dispatchAction({type: 'network/changeNetwork', payload: {networkIdentifier, nodeUrl}});
        await store.dispatchAction({type: 'wallet/loadAll'});
        await store.dispatchAction({type: 'network/fetchData'});
        await store.dispatchAction({type: 'account/fetchData'});
    }, null, handleError);
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
                <StyledText type="title">
                    {/* notranslate */}
                    Select Network:
                </StyledText>
                {/* notranslate */}
                <Dropdown value={selectedNetworkIdentifier} list={networkIdentifiers} title="Network Type" onChange={selectNetwork} />
            </FormItem>
            <FormItem clear="bottom" fill>
                <StyledText type="title">
                    {/* notranslate */}
                    Select Node:
                </StyledText>
                <FlatList 
                    data={networkNodes} 
                    keyExtractor={(item, index) => 'nl' + item + index} 
                    renderItem={({item, index}) => (
                    <FormItem type="list">
                        <TouchableOpacity style={getNodeStyle(item)} onPress={() => selectNode(item)}>
                            <StyledText type="body">
                                {getNodeTitle(item)}
                            </StyledText>
                        </TouchableOpacity>
                    </FormItem>
                )} />
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
        backgroundColor: colors.accentLightForm
    }
});
