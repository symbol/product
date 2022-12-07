import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { trunc } from 'src/utils';
import { TransactionType } from 'symbol-sdk';
import { ButtonCopy, FormItem, StyledText } from 'src/components';

const TRANSLATION_ROOT_KEY = 'table';
const renderTypeMap = {
    copyButton: [
        'address',
        'recipientAddress',
        'signerAddress',
        'linkedAccountAddress',
        'targetAddress',
        'metadataValue',
        'publicKey',
        'vrfPublicKey',
        'remotePublicKey',
        'linkedPublicKey',
        'nodePublicKey',
        'secret',
        'proof',
        '_restrictionAddressAdditions',
        '_restrictionAddressDeletions',
        '_addressAdditions',
        '_receivedCosignatures',
        '_addressDeletions',
    ],
    boolean: ['supplyMutable', 'transferable', 'restrictable'],
    amount: ['amount', 'resolvedFee'],
    secret: ['privateKey', 'remotePrivateKey', 'vrfPrivateKey'],
    mosaics: ['mosaics'],
    namespaces: ['accountAliasNames'],
    encryption: ['messageEncrypted'],
    transactionType: ['transactionType', '_restrictionOperationAdditions', '_restrictionOperationDeletions'],
    translate: [
        'registrationType',
        'aliasAction',
        'action',
        'restrictionType',
        'previousRestrictionType',
        'newRestrictionType',
        'linkAction',
    ],
};

export const TableView = connect(state => ({
    currentAccount: state.account.current,
    ticker: state.network.ticker,
}))(function TableView(props) {
    const { data } = props;

    if (!data) {
        return null;
    }

    let tableData = data;

    if (!Array.isArray(data)) {
        tableData = Object.entries(data)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key, value]) => ({key, value}));
    }

    const renderValue = (item) => {
        let ItemTemplate = (
            <StyledText type="body">
                {item.value}
            </StyledText>
        );
        
        Object.keys(renderTypeMap).forEach(renderType => renderTypeMap[renderType].find(acceptedKey => {
            if (item.key !== acceptedKey) {
                return false;
            }

            switch (renderType) {
                case 'copyButton':
                    ItemTemplate = (
                        <View style={styles.row}>
                            <StyledText type="body">
                                {item.value}
                            </StyledText>
                            <ButtonCopy data={item.value} style={styles.button}/>
                        </View>
                    );
                    break;
            }

            return true;
        }));

        return ItemTemplate;
    }

    return (
        <View>
            {tableData.map((item, index) => (
                <FormItem type="list" key={'table' + item.key + index}>
                    <StyledText type="subtitle">
                        {item.key}
                    </StyledText>
                    {renderValue(item)}
                </FormItem>
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
    },
    button: {
        paddingLeft: spacings.paddingSm
    }
});
