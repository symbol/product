import React, { useEffect, useState } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { Dropdown, Screen, FormItem, StyledText, LoadingIndicator } from 'src/components';
import store, { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { clearCache, usePasscode } from 'src/utils';

export const SettingsNetwork = connect(state => ({
    currentAccount: state.account.current,
    nodeUrl: state.network.selectedNodeUrl,
    networkIdentifier: state.network.networkIdentifier,
    nodeUrls: state.network.nodeUrls,
}))(function SettingsNetwork(props) {
    const { nodeUrl, networkIdentifier, nodeUrls } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useState(networkIdentifier);
    const [selectedNodeUrl, setSelectedNodeUrl] = useState(nodeUrl);

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
    const saveChanges = async (networkIdentifier, nodeUrl) => {
        setIsLoading(true);
        try {
            await store.dispatchAction({type: 'network/changeNetwork', payload: {networkIdentifier, nodeUrl}});
            await store.dispatchAction({type: 'wallet/loadAll'});
        }
        catch(error) {
            showMessage({message: error.message, type: 'danger'});
        }
        setIsLoading(false);
    };
    const selectNetwork = async (networkIdentifier) => {
        setSelectedNetworkIdentifier(networkIdentifier);
        setSelectedNodeUrl(null);
        saveChanges(networkIdentifier, null);
    };
    const selectNode = async (nodeUrl) => {
        setSelectedNodeUrl(nodeUrl);
        saveChanges(networkIdentifier, nodeUrl);
    };


    useEffect(() => {
        setSelectedNetworkIdentifier(networkIdentifier);
        setSelectedNodeUrl(nodeUrl);
    }, [networkIdentifier, nodeUrl]);

    return (
        <Screen>
            {isLoading && <LoadingIndicator />}
            <FormItem>
                <StyledText type="title">
                    {/* notranslate */}
                    Select Network:
                </StyledText>
                {/* notranslate */}
                <Dropdown value={selectedNetworkIdentifier} list={networkIdentifiers} title="Network Type" onChange={selectNetwork} />
            </FormItem>
            <FormItem style={styles.fill}>
                <StyledText type="title">
                    {/* notranslate */}
                    Select Node:
                </StyledText>
                <FlatList 
                    style={styles.fill}
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
    fill: {
        flex: 1
    },
    item: {
        borderRadius: borders.borderRadius,
        backgroundColor: colors.bgCard,
        padding: spacings.padding,
    },
    itemSelected: {
        backgroundColor: colors.accentLightForm
    }
});
