import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { connect } from 'src/store';
import { colors, spacings } from 'src/styles';
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
    fee: ['fee', 'maxFee'],
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
    const { data, ticker } = props;

    if (!data || typeof data !== 'object') {
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
        let ItemTemplate;
        
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
                case 'fee':
                    ItemTemplate = (
                        <View style={styles.mosaicName}>
                            <Image source={require('src/assets/images/icon-select-mosaic-native.png')} style={styles.mosaicIcon} />
                            <StyledText type="body" style={styles.fee}>
                                {item.value} {ticker}
                            </StyledText>
                        </View>
                    );
                    break;
                case 'mosaics':
                    const getMosaicIconSrc = mosaic => mosaic.name === 'symbol.xym' 
                        ? require('src/assets/images/icon-select-mosaic-native.png')
                        : require('src/assets/images/icon-select-mosaic-custom.png');
                    ItemTemplate = (
                        <View style={styles.col}>
                            {item.value.map(mosaic => (
                                <View style={styles.mosaic}>
                                    <View style={styles.mosaicName}>
                                        <Image source={getMosaicIconSrc(mosaic)} style={styles.mosaicIcon} />
                                        <StyledText type="body">
                                            {mosaic.name}
                                        </StyledText>
                                    </View>
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

        if (!ItemTemplate && Array.isArray(item.value) && item.value.length) {
            return item.value.map(value => renderValue({key: `_${item.key}`, value: value}));
        }

        if (!ItemTemplate && typeof item.value === 'object') {
            return null;
        }

        if (!ItemTemplate) {
            ItemTemplate = (
                <StyledText type="body">
                    {item.value}
                </StyledText>
            )
        }

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
    col: {
        width: '100%',
        flexDirection: 'column',
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
    },
    mosaicName: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    mosaicIcon: {
        height: 24,
        width: 24,
        marginRight: spacings.paddingSm
    },
    fee: {
        color: colors.danger
    }
});
