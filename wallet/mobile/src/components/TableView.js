import React from 'react';
import { StyleSheet, View } from 'react-native';

import { connect } from 'src/store';
import { spacings } from 'src/styles';
import { ButtonCopy, FormItem, StyledText } from 'src/components';
import { $t } from 'src/localization';

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

    const renderKey = (item) => {
        const translatedKey = $t(`data_${item.key}`);

        return (
            <StyledText type="label" style={styles.key}>
                {translatedKey}
            </StyledText>
        )
    };

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
                case 'encryption':
                    ItemTemplate = (
                        <View style={styles.row}>
                            <StyledText type="body">
                                {item.value === true 
                                    ? $t('data_encrypted')
                                    : $t('data_unencrypted')
                                }
                            </StyledText>
                        </View>
                    );
                    break;
                case 'mosaics':
                    ItemTemplate = (
                        <View style={styles.row}>
                            {item.value.map(mosaic => (
                                <View style={styles.mosaic}>
                                    <StyledText type="body">
                                        {mosaic.name || mosaic.id}
                                    </StyledText>
                                    <StyledText type="body">
                                        {mosaic.amount}
                                    </StyledText>
                                </View>
                            ))}
                        </View>
                    );
                    break;
            }

            return true;
        }));

        return ItemTemplate;
    }

    const isEmptyField = item => item.value === '' || item.value === null;

    return (
        <View>
            {tableData.map((item, index) => (isEmptyField(item) 
                ? null
                : <FormItem key={'table' + item.key + index}>
                    {renderKey(item)}
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
        width: '100%',
        flexDirection: 'row',
    },
    key: {
        opacity: 0.8,
    },
    button: {
        paddingLeft: spacings.paddingSm
    },
    mosaic: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
    }
});
